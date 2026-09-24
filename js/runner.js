/*
 * Talks to the Python worker. If the player's code gets stuck, the worker is
 * thrown away and a fresh one is started.
 */
(function (root) {
  'use strict';

  function PyRunner(onStatus) {
    this.onStatus = onStatus || function () {};
    this.worker = null;
    this.ready = null;
    this.pending = null;
    this.nextId = 1;
    this.start();
  }

  PyRunner.prototype.start = function () {
    var self = this;
    this.onStatus('loading');
    this.worker = new Worker('js/python-worker.js');
    this.ready = new Promise(function (resolve, reject) {
      self.worker.onmessage = function (ev) {
        var msg = ev.data;
        if (msg.type === 'ready') {
          self.onStatus('ready');
          resolve();
        } else if (msg.type === 'load-error') {
          self.onStatus('error', msg.message);
          reject(new Error(msg.message));
        } else if (msg.type === 'result' && self.pending && self.pending.id === msg.id) {
          var p = self.pending;
          self.pending = null;
          clearTimeout(p.timer);
          p.resolve(msg);
        }
      };
      self.worker.onerror = function (e) {
        self.onStatus('error', e.message);
        reject(new Error(e.message));
      };
    });
    this.ready.catch(function () {});
  };

  PyRunner.prototype.restart = function () {
    if (this.worker) this.worker.terminate();
    this.start();
  };

  // payload: {mode, code, maps?, options?, tests?}
  PyRunner.prototype.run = function (payload, timeoutMs) {
    var self = this;
    timeoutMs = timeoutMs || 8000;
    if (this.pending) this.stop();
    return this.ready.then(function () {
      return new Promise(function (resolve) {
        var id = self.nextId++;
        var timer = setTimeout(function () {
          if (!self.pending || self.pending.id !== id) return;
          self.pending = null;
          self.restart();
          resolve({ id: id, timedOut: true });
        }, timeoutMs);
        self.pending = { id: id, resolve: resolve, timer: timer };
        self.worker.postMessage(Object.assign({ type: 'run', id: id }, payload));
      });
    });
  };

  PyRunner.prototype.stop = function () {
    if (!this.pending) return;
    var p = this.pending;
    this.pending = null;
    clearTimeout(p.timer);
    this.restart();
    p.resolve({ id: p.id, stopped: true });
  };

  root.PyRunner = PyRunner;
})(window);

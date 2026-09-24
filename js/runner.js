/*
 * Talks to the Python worker. If the player's code gets stuck, the worker is
 * thrown away and a fresh one is started.
 */
(function (root) {
  'use strict';

  var DEFAULT_PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

  // Build the worker from code the page already loaded (engine.js and
  // python-worker.js). A blob worker also works when the page is opened
  // straight from a folder (file://), where normal workers are blocked.
  function workerURL() {
    /* global SnakeEngineFactory, BlockSnakeWorker */
    var pyUrl = new URL(root.BLOCKSNAKE_PYODIDE_URL || DEFAULT_PYODIDE_URL, location.href).href;
    var stdlibJs = root.BLOCKSNAKE_STDLIB_JS ? new URL(root.BLOCKSNAKE_STDLIB_JS, location.href).href : '';
    var src =
      'var SnakeEngineFactory = ' + SnakeEngineFactory.toString() + ';\n' +
      'SnakeEngineFactory(self);\n' +
      '(' + BlockSnakeWorker.toString() + ')(' + JSON.stringify(pyUrl) + ', ' + JSON.stringify(stdlibJs) + ');\n';
    return URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  }

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
    this.ready = new Promise(function (resolve, reject) {
      try {
        self.worker = new Worker(workerURL());
      } catch (err) {
        self.worker = null;
        self.onStatus('error', String(err && err.message || err));
        reject(err);
        return;
      }
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
        reject(new Error(e.message || 'Python could not start'));
      };
    });
    this.ready.catch(function () { self.failed = true; });
  };

  PyRunner.prototype.restart = function () {
    if (this.worker) this.worker.terminate();
    this.worker = null;
    this.start();
  };

  // payload: {mode, code, maps?, options?, tests?}
  PyRunner.prototype.run = function (payload, timeoutMs) {
    var self = this;
    timeoutMs = timeoutMs || 8000;
    if (this.pending) this.stop();
    // Loading failed before (maybe the internet was off)? Try again.
    if (this.failed) { this.failed = false; this.restart(); }
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

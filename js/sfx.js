/*
 * Tiny sound effects made with the Web Audio API (no sound files needed).
 */
(function (root) {
  'use strict';

  var ctx = null;
  var muted = false;

  function audio() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    var a = audio();
    if (!a || muted) return;
    var t = a.currentTime + (when || 0);
    var o = a.createOscillator();
    var g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, when, filterFreq) {
    var a = audio();
    if (!a || muted) return;
    var t = a.currentTime + (when || 0);
    var len = Math.floor(a.sampleRate * dur);
    var buf = a.createBuffer(1, len, a.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = a.createBufferSource();
    src.buffer = buf;
    var f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    var g = a.createGain();
    g.gain.value = vol || 0.15;
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start(t);
  }

  var Sfx = {
    setMuted: function (m) { muted = !!m; },
    isMuted: function () { return muted; },
    click: function () { tone(660, 0.05, 'square', 0.04); },
    step: function () { noise(0.05, 0.05, 0, 700); },
    eat: function () {
      noise(0.08, 0.18, 0, 2500);
      tone(520, 0.08, 'square', 0.05, 0.02, 780);
    },
    crash: function () {
      noise(0.35, 0.3, 0, 500);
      tone(180, 0.3, 'sawtooth', 0.06, 0, 70);
    },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.18, 'square', 0.06, i * 0.1); });
      [1319, 1568].forEach(function (f, i) { tone(f, 0.25, 'triangle', 0.05, 0.45 + i * 0.12); });
    },
    orb: function () { tone(1400 + Math.random() * 600, 0.08, 'sine', 0.05); },
    error: function () { tone(220, 0.15, 'square', 0.05); tone(160, 0.2, 'square', 0.05, 0.12); },
    pop: function () { tone(880, 0.06, 'triangle', 0.06, 0, 1320); }
  };

  root.Sfx = Sfx;
})(window);

/*
 * BlockSnake app: screens, editor, running code, stars and saving progress.
 */
/* global GameData, PracticeData, SnakeEngine, BlockTextures, WorldView, PyRunner, Sfx, CodeMirror */
(function () {
  'use strict';

  var LEVELS = GameData.LEVELS;
  var WORLDS = GameData.WORLDS;
  var MAX_STARS = LEVELS.length * 3;

  // ------------------------------------------------------------------
  // Saved progress (kept in this browser only)
  // ------------------------------------------------------------------
  var STORE_KEY = 'blocksnake.v1';
  function defaults() {
    return { stars: {}, code: {}, practice: {}, pcode: {}, muted: false, speed: 1, unlockAll: false, playground: '' };
  }
  var store = (function () {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return Object.assign(defaults(), saved);
    } catch (e) {
      return defaults();
    }
  })();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* private mode: ok */ }
  }

  // ------------------------------------------------------------------
  // Small helpers
  // ------------------------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  var spriteCache = {};
  function spriteURL(name) {
    if (!spriteCache[name]) spriteCache[name] = BlockTextures.get(name).toDataURL();
    return spriteCache[name];
  }
  function spriteImg(name, cls) {
    var img = new Image();
    img.src = spriteURL(name);
    img.alt = '';
    if (cls) img.className = cls;
    return img;
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ------------------------------------------------------------------
  // Pixel textures for the page itself
  // ------------------------------------------------------------------
  function paintTextures() {
    var rs = document.documentElement.style;
    rs.setProperty('--tex-dirt', 'url(' + BlockTextures.dataURL('dirt', 4, 0.55) + ')');
    rs.setProperty('--tex-stone', 'url(' + BlockTextures.dataURL('stone', 3) + ')');
    rs.setProperty('--tex-grass', 'url(' + BlockTextures.dataURL('grass_top', 4) + ')');
    rs.setProperty('--tex-planks', 'url(' + BlockTextures.dataURL('planks', 4) + ')');
    $('favicon').href = BlockTextures.blockIcon('grass_top', 'grass_side', 32).toDataURL();
    document.querySelectorAll('[data-sprite]').forEach(function (img) {
      img.src = spriteURL(img.getAttribute('data-sprite'));
    });
  }

  // ------------------------------------------------------------------
  // Sound buttons
  // ------------------------------------------------------------------
  function updateMuteButtons() {
    Sfx.setMuted(store.muted);
    document.querySelectorAll('[data-mute]').forEach(function (b) {
      b.textContent = 'Sound: ' + (store.muted ? 'Off' : 'On');
    });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-mute]');
    if (t) { store.muted = !store.muted; save(); updateMuteButtons(); }
    if (e.target.closest('[data-sfx]')) Sfx.click();
  });

  // ------------------------------------------------------------------
  // Python runner
  // ------------------------------------------------------------------
  var pyState = 'loading';
  function setPyStatus(state, msg) {
    pyState = state;
    var text = state === 'ready' ? 'Python ready' :
      state === 'error' ? 'Python could not load. Check your internet and reload.' :
        'Python is waking up…';
    document.querySelectorAll('.py-status').forEach(function (s) {
      s.textContent = text;
      s.classList.toggle('ready', state === 'ready');
      s.classList.toggle('error', state === 'error');
      if (msg) s.title = msg;
    });
  }
  var runner = new PyRunner(setPyStatus);

  // ------------------------------------------------------------------
  // Code editor (CodeMirror, or a plain textarea if it couldn't load)
  // ------------------------------------------------------------------
  function makeEditor(textarea, onRun) {
    var errorMark = null;
    if (window.CodeMirror) {
      var cm = CodeMirror.fromTextArea(textarea, {
        mode: 'python',
        lineNumbers: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        matchBrackets: true,
        viewportMargin: Infinity,
        extraKeys: {
          Tab: function (c) {
            if (c.somethingSelected()) c.indentSelection('add');
            else c.replaceSelection('    ');
          },
          'Shift-Tab': 'indentLess',
          Backspace: function (c) {
            var cur = c.getCursor();
            var before = c.getLine(cur.line).slice(0, cur.ch);
            if (!c.somethingSelected() && before.length && /^ +$/.test(before) && before.length % 4 === 0) {
              c.replaceRange('', { line: cur.line, ch: cur.ch - 4 }, cur);
            } else {
              return CodeMirror.Pass;
            }
          },
          'Ctrl-Enter': function () { onRun(); },
          'Cmd-Enter': function () { onRun(); }
        }
      });
      return {
        cm: cm,
        get: function () { return cm.getValue(); },
        set: function (v) { cm.setValue(v); cm.clearHistory(); },
        focus: function () { cm.focus(); },
        refresh: function () { setTimeout(function () { cm.refresh(); }, 0); },
        onChange: function (fn) { cm.on('change', fn); },
        markError: function (line) {
          this.clearMarks();
          if (!line || line < 1 || line > cm.lineCount()) return;
          errorMark = cm.addLineClass(line - 1, 'background', 'cm-error-line');
          cm.scrollIntoView({ line: line - 1, ch: 0 }, 60);
        },
        clearMarks: function () {
          if (errorMark) { cm.removeLineClass(errorMark, 'background', 'cm-error-line'); errorMark = null; }
        },
        insertSnippet: function (text) {
          var doc = cm.getDoc();
          var cur = doc.getCursor();
          var line = doc.getLine(cur.line);
          var indent = (line.match(/^\s*/) || [''])[0];
          var body = text.replace(/\n$/, '').split('\n').map(function (l, i) { return (i ? indent : '') + l; }).join('\n');
          var endsLine = /\n$/.test(text);
          if (line.trim() === '') {
            doc.replaceRange(indent + body + (endsLine ? '\n' + indent : ''), { line: cur.line, ch: 0 }, { line: cur.line, ch: line.length });
          } else if (cur.ch < line.length && !endsLine) {
            doc.replaceRange(body, cur);
          } else {
            doc.replaceRange('\n' + indent + body + (endsLine ? '' : ''), { line: cur.line, ch: line.length });
          }
          cm.focus();
        }
      };
    }
    // Fallback: plain textarea
    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        var s = textarea.selectionStart;
        textarea.setRangeText('    ', s, textarea.selectionEnd, 'end');
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onRun();
      }
    });
    return {
      get: function () { return textarea.value; },
      set: function (v) { textarea.value = v; },
      focus: function () { textarea.focus(); },
      refresh: function () {},
      onChange: function (fn) { textarea.addEventListener('input', fn); },
      markError: function (line) {
        if (!line) return;
        var lines = textarea.value.split('\n');
        var start = 0;
        for (var i = 0; i < line - 1 && i < lines.length; i++) start += lines[i].length + 1;
        textarea.focus();
        textarea.setSelectionRange(start, start + (lines[line - 1] || '').length);
      },
      clearMarks: function () {},
      insertSnippet: function (text) {
        var s = textarea.selectionStart;
        textarea.setRangeText(text, s, textarea.selectionEnd, 'end');
        textarea.focus();
      }
    };
  }

  // ------------------------------------------------------------------
  // Modal dialog
  // ------------------------------------------------------------------
  function openModal(title, bodyHTML, actions) {
    $('modal-title').textContent = title;
    var body = $('modal-body');
    if (typeof bodyHTML === 'string') body.innerHTML = bodyHTML;
    else { body.innerHTML = ''; body.appendChild(bodyHTML); }
    var box = $('modal-actions');
    box.innerHTML = '';
    (actions || [{ label: 'OK' }]).forEach(function (a) {
      var b = el(a.href ? 'a' : 'button', 'mc-btn' + (a.green ? ' green' : ''), esc(a.label));
      if (a.href) b.href = a.href;
      b.addEventListener('click', function () {
        Sfx.click();
        closeModal();
        if (a.onClick) a.onClick();
      });
      box.appendChild(b);
    });
    $('modal').hidden = false;
    var first = box.querySelector('.mc-btn');
    if (first) first.focus();
  }
  function closeModal() { $('modal').hidden = true; }
  $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('modal').hidden) closeModal(); });

  function showHowTo() {
    openModal('How to Play',
      '<p>Pip the snake only moves when <b>you</b> write Python code!</p>' +
      '<ul>' +
      '<li>Read the <b>lesson book</b> to learn something new.</li>' +
      '<li>Write code in the black box, or click the <b>hotbar</b> blocks to add code.</li>' +
      '<li>Press <b>&#9654; Run</b> and watch Pip follow your orders.</li>' +
      '<li>Eat <b>all the apples</b> to win. Don’t bump into blocks, water, lava or your own tail!</li>' +
      '<li>Earn up to <b>3 stars</b>: finish the level, use the new idea, and keep your code short.</li>' +
      '<li>Stuck? Press <b>Hint</b>. After 3 tries you can see the solution.</li>' +
      '</ul>' +
      '<p>Want more practice? The <b>Practice Zone</b> has 30+ small coding puzzles.</p>',
      [{ label: 'Let’s go!', green: true }]);
  }
  $('btn-howto').addEventListener('click', showHowTo);

  // ------------------------------------------------------------------
  // Router
  // ------------------------------------------------------------------
  var VIEWS = ['view-home', 'view-map', 'view-level', 'view-practice', 'view-playground'];
  function show(id) {
    VIEWS.forEach(function (v) { $(v).hidden = v !== id; });
    window.scrollTo(0, 0);
  }

  function route() {
    closeModal();
    if (level.running) stopRun();
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    switch (parts[0]) {
      case 'map': showMap(); break;
      case 'level': showLevel(parseInt(parts[1], 10)); break;
      case 'free': showLevel('free'); break;
      case 'practice': showPractice(parts[1]); break;
      case 'playground': showPlayground(); break;
      default: showHome();
    }
  }
  window.addEventListener('hashchange', route);

  function has3D() { return !!window.THREE; }

  // ------------------------------------------------------------------
  // Home screen
  // ------------------------------------------------------------------
  var SPLASHES = [
    'Sssssuper!', 'Now with 100% Python!', 'Don’t forget the colon!', 'Loops are fun!',
    'Indent with 4 spaces!', 'print("Hello!")', 'Apples are tasty!', 'Made of blocks!',
    'while True: learn()', 'Also try the Practice Zone!', 'Hisss-tory in the making!', 'range(10) of fun!'
  ];
  var HOME_MAP = [
    '..T..........T..',
    'T.....RR........',
    '...S..A...A..T..',
    '..............T.',
    '.T....WWW.......',
    '...A..WWW...A...',
    '...............T',
    '..T.....A.......',
    '......T.....R...',
    'T..............T'
  ];
  var homeView = null;
  function homeTimeline() {
    var g = SnakeEngine.createGame(HOME_MAP);
    g.say('Hi! I’m Pip!');
    [['right', 9], ['down', 5], ['left', 9], ['up', 5]].forEach(function (p) {
      for (var i = 0; i < p[1]; i++) g.move(p[0]);
    });
    return g;
  }
  function homeLoop() {
    if (!homeView || homeView.destroyed) return;
    var g = homeTimeline();
    homeView.load(g.initial, 'plains');
    homeView.cam.zoom = 0.82;
    homeView.play(g.timeline).then(function (r) {
      if (r && r.done) setTimeout(homeLoop, 600);
    });
  }
  function showHome() {
    show('view-home');
    $('splash').textContent = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
    if (!homeView && has3D()) {
      try {
        homeView = new WorldView($('home-world'), { autoRotate: true });
        homeView.setSpeed(0.8);
        homeLoop();
      } catch (e) { console.warn(e); }
    }
  }

  // ------------------------------------------------------------------
  // World map
  // ------------------------------------------------------------------
  function starsFor(id) { return store.stars[id] || 0; }
  function isUnlocked(id) {
    if (store.unlockAll || id === 1) return true;
    return starsFor(id - 1) > 0;
  }
  function totalStars() {
    return LEVELS.reduce(function (s, l) { return s + starsFor(l.id); }, 0);
  }
  var WORLD_ICONS = {
    plains: ['grass_top', 'grass_side'], forest: ['grass_dark_top', 'log_side'], desert: ['sand', 'sand'],
    snow: ['snow_top', 'snow_side'], beach: ['sand', 'sandstone_side'], darkforest: ['dark_log_top', 'dark_log_side'],
    ice: ['packed_ice', 'ice'], lava: ['lava', 'obsidian']
  };
  var iconCache = {};
  function worldIcon(theme) {
    if (!iconCache[theme]) {
      var t = WORLD_ICONS[theme];
      iconCache[theme] = BlockTextures.blockIcon(t[0], t[1], 64).toDataURL();
    }
    var img = new Image();
    img.src = iconCache[theme];
    img.alt = '';
    return img;
  }

  function updateXP() {
    var stars = totalStars();
    var done = LEVELS.filter(function (l) { return starsFor(l.id) > 0; }).length;
    $('xp-level').textContent = done;
    $('xp-fill').style.width = (stars / MAX_STARS * 100) + '%';
    $('xp-label').textContent = stars + ' / ' + MAX_STARS + ' stars';
  }

  function showMap() {
    show('view-map');
    updateXP();
    $('unlock-all').checked = !!store.unlockAll;
    var list = $('world-list');
    list.innerHTML = '';
    var firstOpen = null;
    LEVELS.forEach(function (l) { if (firstOpen === null && isUnlocked(l.id) && !starsFor(l.id)) firstOpen = l.id; });
    WORLDS.forEach(function (w) {
      var levels = LEVELS.filter(function (l) { return l.world === w.id; });
      var card = el('div', 'world-card mc-panel');
      if (!isUnlocked(levels[0].id)) card.classList.add('locked');
      var head = el('div', 'world-head');
      head.appendChild(worldIcon(w.theme));
      var names = el('div', '', '<div class="world-name">' + w.id + '. ' + esc(w.name) + '</div>' +
        '<div class="world-concept">Learn: <b>' + esc(w.concept) + '</b>. ' + esc(w.blurb) + '</div>');
      head.appendChild(names);
      card.appendChild(head);
      var slots = el('div', 'level-slots');
      levels.forEach(function (l) {
        var open = isUnlocked(l.id);
        var a = el(open ? 'a' : 'div', 'level-slot slot' + (open ? '' : ' locked') + (l.id === firstOpen ? ' current' : ''));
        a.title = open ? l.title : 'Finish the level before to unlock';
        if (open) {
          a.href = '#/level/' + l.id;
          a.setAttribute('data-sfx', '');
          a.appendChild(el('span', '', String(l.id)));
          var st = el('span', 'stars');
          for (var i = 1; i <= 3; i++) st.appendChild(spriteImg('star', i <= starsFor(l.id) ? '' : 'off'));
          a.appendChild(st);
        } else {
          a.appendChild(spriteImg('lock', 'lock'));
        }
        slots.appendChild(a);
      });
      card.appendChild(slots);
      var group = PracticeData.GROUPS.filter(function (g) { return g.world === w.id; })[0];
      if (group) {
        var extra = el('div', 'world-extra');
        var doneCount = PracticeData.EXERCISES.filter(function (e) { return e.group === group.id && store.practice[e.id]; }).length;
        var total = PracticeData.EXERCISES.filter(function (e) { return e.group === group.id; }).length;
        extra.innerHTML = '<span>Practice: ' + esc(group.name) + ' (' + doneCount + '/' + total + ')</span>';
        var btn = el('a', 'mc-btn tiny', 'Practice');
        btn.href = '#/practice/' + PracticeData.EXERCISES.filter(function (e) { return e.group === group.id; })[0].id;
        btn.setAttribute('data-sfx', '');
        extra.appendChild(btn);
        card.appendChild(extra);
      }
      list.appendChild(card);
    });
  }
  $('unlock-all').addEventListener('change', function () {
    store.unlockAll = this.checked;
    save();
    showMap();
  });

  // ------------------------------------------------------------------
  // Level screen
  // ------------------------------------------------------------------
  var level = { data: null, view: null, editor: null, running: false, attempts: 0, hint: 0, seed: 1 };
  var outputEl = $('output');

  function levelWorld(l) { return WORLDS.filter(function (w) { return w.id === l.world; })[0]; }

  function ensureLevelScreen() {
    if (!level.editor) {
      level.editor = makeEditor($('code'), runLevel);
      level.editor.onChange(function () {
        if (!level.data) return;
        store.code[level.data.id] = level.editor.get();
        save();
      });
    }
    if (!level.view && has3D()) {
      try {
        level.view = new WorldView($('game-box'));
        level.view.setSpeed(store.speed);
      } catch (e) {
        console.warn(e);
      }
    }
    if (!has3D() && !$('game-box').querySelector('.no3d')) {
      $('game-box').appendChild(el('div', 'no3d', 'The 3D world could not load. Check your internet connection and reload the page. Your code will still run and print!'));
    }
  }

  function levelOptions(l) {
    return l.free ? { randomApples: 12, seed: level.seed, moveLimit: 1000 } : {};
  }

  function loadLevelMap(index) {
    var l = level.data;
    var initial = SnakeEngine.parseMap(l.maps[index], levelOptions(l));
    level.applesLeft = initial.apples.length;
    $('hud-apples').textContent = level.applesLeft;
    var multi = l.maps.length > 1;
    $('hud-map').hidden = !multi;
    $('hud-map').textContent = 'Map ' + (index + 1) + ' of ' + l.maps.length;
    if (level.view) level.view.load(initial, levelWorld(l).theme);
  }

  function renderHotbar(w) {
    var bar = $('hotbar');
    bar.innerHTML = '';
    var glyphs = {
      loop: ['for', '#ffaa00'], box: ['x=', '#55ffff'], sign: ['abc', '#ffffff'], bubble: ['"hi"', '#ffffff'],
      clock: ['while', '#ffaa00'], fork: ['if', '#ffaa00'], book: ['def', '#ff55ff'], chest: ['[ ]', '#55ffff']
    };
    w.hotbar.slice(0, 9).forEach(function (key, i) {
      var item = GameData.HOTBAR[key];
      var b = el('button', 'hot-slot');
      b.type = 'button';
      b.title = 'Add ' + item.label + ' to your code';
      b.appendChild(el('span', 'num', String(i + 1)));
      if (/^arrow-/.test(item.icon)) {
        var dir = item.icon.slice(6);
        var c = document.createElement('canvas');
        c.width = c.height = 16;
        var ctx = c.getContext('2d');
        ctx.translate(8, 8);
        ctx.rotate({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir]);
        ctx.drawImage(BlockTextures.get('arrow-right'), -8, -8);
        b.appendChild(c);
      } else if (item.icon === 'apple' || item.icon === 'boots' || item.icon === 'compass') {
        b.appendChild(spriteImg(item.icon === 'compass' ? 'apple' : item.icon));
      } else {
        var g = glyphs[item.icon] || ['?', '#fff'];
        var span = el('span', 'glyph', esc(g[0]));
        span.style.color = g[1];
        b.appendChild(span);
      }
      b.appendChild(el('span', 'cap', esc(item.label)));
      b.addEventListener('click', function () {
        Sfx.pop();
        level.editor.insertSnippet(item.code);
      });
      bar.appendChild(b);
    });
  }

  function renderStarGoals(l, result) {
    var ul = $('star-goals');
    ul.innerHTML = '';
    if (l.free) return;
    var goals = starRules(l);
    goals.forEach(function (g, i) {
      var li = el('li', result && result.rules[i] ? 'done' : '');
      li.appendChild(spriteImg('star'));
      li.appendChild(document.createTextNode(g));
      ul.appendChild(li);
    });
  }

  function starRules(l) {
    var req = (l.requires || []).map(function (r) { return GameData.REQUIRE_LABELS[r] || r; });
    return [
      'Eat every apple' + (l.expectOutput ? ' and print the right answer' : ''),
      req.length ? 'Use ' + req.join(' + ') : 'Finish without crashing',
      l.par ? 'Use ' + l.par + ' lines of code or fewer' : 'Keep your code short'
    ];
  }

  function computeStars(l, analysis) {
    var uses = analysis.uses || [];
    var missing = (l.requires || []).filter(function (r) { return uses.indexOf(r) < 0; });
    var short = !l.par || analysis.lines <= l.par;
    var rules = [true, missing.length === 0, short];
    return { stars: rules.filter(Boolean).length, rules: rules, missing: missing, lines: analysis.lines };
  }

  function showLevel(id) {
    var l = id === 'free' ? GameData.FREE_PLAY : LEVELS.filter(function (x) { return x.id === id; })[0];
    if (!l) { location.hash = '#/map'; return; }
    if (!l.free && !isUnlocked(l.id)) { location.hash = '#/map'; return; }
    show('view-level');
    ensureLevelScreen();
    level.data = l;
    level.attempts = 0;
    level.hint = 0;
    level.seed = Math.floor(Math.random() * 1e9);
    var w = levelWorld(l);
    $('level-world').textContent = l.free ? 'Free Play' : 'World ' + w.id + ': ' + w.name + ' · Level ' + l.id;
    $('level-name').textContent = l.title;
    $('level-back').href = l.free ? '#/' : '#/map';
    $('level-back').innerHTML = l.free ? '&larr; Menu' : '&larr; Levels';
    $('lesson-title').textContent = l.free ? 'Free Play' : 'Lesson: ' + l.title;
    $('lesson-goal').textContent = l.goal;
    $('lesson-text').innerHTML = l.lesson;
    $('lesson-example').textContent = l.example;
    $('lesson-details').open = true;
    renderStarGoals(l, null);
    renderHotbar(w);
    level.editor.set(store.code[l.id] != null ? store.code[l.id] : l.starter);
    level.editor.refresh();
    level.editor.clearMarks();
    hideMessage($('message'));
    clearOutput(outputEl, 'Press ▶ Run to see what Pip says here.');
    $('btn-solution').disabled = true;
    $('btn-solution').hidden = !!l.free;
    $('btn-hint').disabled = !l.hints || !l.hints.length;
    setRunning(false);
    loadLevelMap(0);
  }

  function setRunning(on) {
    level.running = on;
    $('btn-run').disabled = on;
    $('btn-stop').disabled = !on;
    $('btn-run').innerHTML = on ? 'Running…' : '&#9654; Run';
  }

  function clearOutput(box, placeholder) {
    box.innerHTML = '';
    if (placeholder) box.appendChild(el('div', 'empty', esc(placeholder)));
  }
  function addOutput(box, text, cls) {
    var empty = box.querySelector('.empty');
    if (empty) empty.remove();
    box.appendChild(el('div', cls || 'line-print', esc(text)));
    box.scrollTop = box.scrollHeight;
  }

  function showMessage(box, kind, title, text, extra) {
    box.className = 'message ' + kind;
    box.innerHTML = '<span class="msg-title">' + esc(title) + '</span>' + (text ? esc(text) : '') + (extra || '');
    box.hidden = false;
  }
  function hideMessage(box) { box.hidden = true; box.innerHTML = ''; }

  function stopRun() {
    runner.stop();
    if (level.view) level.view.cancel();
    setRunning(false);
  }
  $('btn-stop').addEventListener('click', function () {
    stopRun();
    showMessage($('message'), 'crash', 'Stopped', 'You stopped the code. Press Run to try again.');
  });

  function runLevel() {
    if (level.running || !level.data) return;
    var l = level.data;
    var code = level.editor.get();
    store.code[l.id] = code;
    save();
    level.editor.clearMarks();
    hideMessage($('message'));
    clearOutput(outputEl);
    if (pyState !== 'ready') addOutput(outputEl, 'Waking up Python (only the first time)…', 'line-info');
    setRunning(true);
    if (l.free) level.seed = Math.floor(Math.random() * 1e9);
    var opts = levelOptions(l);

    runner.run({ mode: 'level', code: code, maps: l.maps, options: opts }, 12000).then(function (msg) {
      if (!level.running || level.data !== l) return;
      if (msg.stopped) { setRunning(false); return; }
      if (msg.timedOut) {
        setRunning(false);
        Sfx.error();
        showMessage($('message'), 'error', 'Your code never stops!',
          'Python was still busy after 12 seconds. Maybe a while loop that never becomes False?');
        return;
      }
      if (msg.fatal) {
        setRunning(false);
        showMessage($('message'), 'error', 'Python could not start', msg.fatal);
        return;
      }
      level.attempts++;
      if (level.attempts >= 3 && !l.free) $('btn-solution').disabled = false;
      return replayRuns(l, msg);
    }).catch(function (err) {
      setRunning(false);
      showMessage($('message'), 'error', 'Python could not start', String(err && err.message || err) +
        ' - check your internet connection and reload the page.');
    });
  }

  function replayRuns(l, msg) {
    var runs = msg.runs;
    var failIndex = -1;
    for (var i = 0; i < runs.length; i++) {
      if (runs[i].status === 'error' || !runs[i].result.won) { failIndex = i; break; }
    }
    var last = failIndex >= 0 ? failIndex : runs.length - 1;
    if (l.free) last = 0;
    var idx = 0;
    clearOutput(outputEl);

    function playNext() {
      if (!level.running || level.data !== l) return Promise.resolve({ cancelled: true });
      var run = runs[idx];
      loadLevelMap(idx);
      if (runs.length > 1 && !l.free) addOutput(outputEl, '--- Map ' + (idx + 1) + ' of ' + l.maps.length + ' ---', 'line-info');
      var callbacks = {
        onPrint: function (t) { addOutput(outputEl, t); },
        onEat: function () {
          Sfx.eat();
          level.applesLeft = Math.max(0, level.applesLeft - 1);
          $('hud-apples').textContent = level.applesLeft;
        },
        onCrash: function () { Sfx.crash(); }
      };
      var played = level.view ? level.view.play(run.timeline, callbacks) : Promise.resolve(fakePlay(run.timeline, callbacks));
      return played.then(function (r) {
        if (r && r.cancelled) return r;
        if (idx < last) {
          idx++;
          return wait(450).then(playNext);
        }
        return { done: true };
      });
    }

    return playNext().then(function (r) {
      if (r && r.cancelled) return;
      setRunning(false);
      finishLevelRun(l, msg, runs[last], last);
    });
  }

  function fakePlay(timeline, cb) {
    timeline.forEach(function (s) {
      if (s.kind === 'print') cb.onPrint(s.text);
      if (s.kind === 'move' && s.ate) cb.onEat();
      if (s.kind === 'crash') cb.onCrash(s.crash);
    });
    return { done: true };
  }

  function outputMatches(runs, expected) {
    var want = normalise(expected);
    return runs.every(function (r) { return normalise((r.output || []).join('\n')) === want; });
  }
  function normalise(s) {
    return String(s).split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).join('\n').replace(/\n+$/, '');
  }

  function finishLevelRun(l, msg, run, index) {
    var box = $('message');
    var res = run.result;
    if (run.status === 'error') {
      var e = run.error;
      Sfx.error();
      level.editor.markError(e.line);
      showMessage(box, 'error', e.title, e.message, e.raw ? '<span class="raw">' + esc(e.raw) + '</span>' : '');
      return;
    }
    if (res.crashed) {
      if (run.crashLine) level.editor.markError(run.crashLine);
      var where = run.crashLine ? ' (line ' + run.crashLine + ')' : '';
      var extraMap = l.maps.length > 1 && index > 0 ? ' Your code worked on the first map, but this map is different. Use a loop or an if so it works everywhere!' : '';
      showMessage(box, 'crash', 'Oh no! Pip ' + res.crash.text + '!' + where,
        (res.crash.kind === 'tired' ? '' : 'Look at where Pip was going and change your code.') + extraMap);
      return;
    }
    if (l.free) {
      Sfx.win();
      showMessage(box, 'good', 'Pip ate ' + res.eaten + ' of ' + res.applesTotal + ' apples!',
        res.applesLeft === 0 ? 'Amazing, every apple! Run again for new apples.' : 'Run again for new apple spots.');
      if (res.applesLeft === 0 && level.view) level.view.celebrate();
      return;
    }
    if (!res.won) {
      var hint = res.moves === 0 ? 'Pip didn’t move at all. Did you write any move commands?' :
        'Pip stopped, but ' + res.applesLeft + (res.applesLeft === 1 ? ' apple is' : ' apples are') + ' still waiting.';
      if (l.maps.length > 1 && index > 0) hint += ' Your code worked on map 1, but not on map ' + (index + 1) + '. Make it work for any size!';
      showMessage(box, 'crash', 'Almost there!', hint);
      return;
    }
    if (l.expectOutput && !outputMatches(msg.runs, l.expectOutput)) {
      var got = (run.output || []).join('\n') || '(nothing)';
      showMessage(box, 'crash', 'Pip ate everything, but the Output isn’t right yet',
        'The output should be:', '<pre>' + esc(l.expectOutput) + '</pre>Your output was:<pre>' + esc(got) + '</pre>');
      return;
    }
    // Winner!
    var result = computeStars(l, msg.analysis || { uses: [], lines: 0 });
    var before = starsFor(l.id);
    if (result.stars > before) { store.stars[l.id] = result.stars; save(); }
    renderStarGoals(l, result);
    Sfx.win();
    if (level.view) level.view.celebrate();
    var extra = l.maps.length > 1 ? '<p>Your code worked on <b>all ' + l.maps.length + ' maps</b>!</p>' : '';
    setTimeout(function () { showWin(l, result, extra); }, 700);
  }

  function showWin(l, result, extra) {
    var wrap = el('div');
    var stars = el('div', 'win-stars');
    for (var i = 0; i < 3; i++) stars.appendChild(spriteImg('star', i < result.stars ? '' : 'off'));
    wrap.appendChild(stars);
    var rules = starRules(l);
    var ul = el('ul', 'star-list');
    rules.forEach(function (r, i) {
      var li = el('li', result.rules[i] ? '' : 'miss');
      li.appendChild(spriteImg('star'));
      var txt = r;
      if (i === 2 && !result.rules[2]) txt += ' (you used ' + result.lines + ')';
      li.appendChild(document.createTextNode(txt));
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    if (extra) wrap.appendChild(el('div', '', extra));
    if (result.stars < 3) wrap.appendChild(el('p', '', 'Try again to get all 3 stars, or keep going!'));
    var next = LEVELS.filter(function (x) { return x.id === l.id + 1; })[0];
    var titles = ['Level Complete!', 'Great Job!', 'Awesome!', 'PERFECT!'];
    var actions = [];
    if (next) actions.push({ label: 'Next Level →', green: true, href: '#/level/' + next.id });
    else actions.push({ label: 'You beat the game!', green: true, href: '#/map' });
    actions.push({ label: 'Stay here' });
    actions.push({ label: 'Level map', href: '#/map' });
    openModal(titles[result.stars], wrap, actions);
    Array.prototype.forEach.call(stars.children, function (img, i) {
      setTimeout(function () {
        img.classList.add('show');
        if (i < result.stars) Sfx.orb();
      }, 200 + i * 260);
    });
  }

  $('btn-run').addEventListener('click', runLevel);
  $('btn-hint').addEventListener('click', function () {
    var l = level.data;
    if (!l || !l.hints) return;
    var h = l.hints[Math.min(level.hint, l.hints.length - 1)];
    var n = Math.min(level.hint, l.hints.length - 1) + 1;
    var isCode = h.indexOf('\n') >= 0 || /^[\w.]+\(.*\)$/.test(h.trim()) || /^\w+ = /.test(h);
    showMessage($('message'), 'hint', 'Hint ' + n + ' of ' + l.hints.length, isCode ? '' : h, isCode ? '<pre>' + esc(h) + '</pre>' : '');
    level.hint++;
    if (level.hint >= l.hints.length && !l.free) $('btn-solution').disabled = false;
  });
  $('btn-reset').addEventListener('click', function () {
    var l = level.data;
    openModal('Start over?', '<p>This puts the starting code back and removes your changes.</p>', [
      { label: 'Yes, reset', green: true, onClick: function () {
        stopRun();
        level.editor.set(l.starter);
        store.code[l.id] = l.starter;
        save();
        hideMessage($('message'));
        clearOutput(outputEl, 'Press ▶ Run to see what Pip says here.');
        loadLevelMap(0);
      } },
      { label: 'Cancel' }
    ]);
  });
  $('btn-solution').addEventListener('click', function () {
    var l = level.data;
    openModal('Show the solution?', '<p>You learn the most by trying yourself, but it’s OK to peek! Read the solution carefully so you understand <b>why</b> it works.</p>', [
      { label: 'Show me', green: true, onClick: function () { level.editor.set(l.solution); } },
      { label: 'I’ll keep trying' }
    ]);
  });
  $('btn-copy-example').addEventListener('click', function () {
    Sfx.pop();
    level.editor.insertSnippet(level.data.example + '\n');
  });
  $('btn-camera').addEventListener('click', function () { if (level.view) level.view.resetCamera(); });
  $('speed').value = store.speed;
  $('speed').addEventListener('input', function () {
    store.speed = parseFloat(this.value);
    save();
    if (level.view) level.view.setSpeed(store.speed);
  });

  // ------------------------------------------------------------------
  // Practice Zone
  // ------------------------------------------------------------------
  var practice = { editor: null, ex: null, running: false };
  var EX = PracticeData.EXERCISES;

  function renderPracticeList() {
    var list = $('practice-list');
    list.innerHTML = '';
    PracticeData.GROUPS.forEach(function (g) {
      var items = EX.filter(function (e) { return e.group === g.id; });
      var done = items.filter(function (e) { return store.practice[e.id]; }).length;
      var wrap = el('div', 'practice-group');
      wrap.appendChild(el('h4', '', esc(g.name) + ' <small>' + done + '/' + items.length + '</small>'));
      items.forEach(function (e) {
        var a = el('a', 'ex-link slot' + (practice.ex && practice.ex.id === e.id ? ' active' : ''));
        a.href = '#/practice/' + e.id;
        a.innerHTML = esc(e.title) + (store.practice[e.id] ? '<span class="check">✔</span>' : '');
        wrap.appendChild(a);
      });
      list.appendChild(wrap);
    });
  }

  function showPractice(id) {
    show('view-practice');
    if (!practice.editor) {
      practice.editor = makeEditor($('practice-code'), checkPractice);
      practice.editor.onChange(function () {
        if (practice.ex) { store.pcode[practice.ex.id] = practice.editor.get(); save(); }
      });
    }
    var ex = EX.filter(function (e) { return e.id === id; })[0] ||
      EX.filter(function (e) { return !store.practice[e.id]; })[0] || EX[0];
    practice.ex = ex;
    renderPracticeList();
    var group = PracticeData.GROUPS.filter(function (g) { return g.id === ex.group; })[0];
    var n = EX.indexOf(ex) + 1;
    $('practice-task').innerHTML = '<h3>' + esc(ex.title) + ' <small>&middot; ' + esc(group.name) + ' &middot; ' + n + ' of ' + EX.length + '</small></h3>' +
      '<p>' + ex.task + '</p>' +
      (ex.expect ? '<div class="example-head">Your output should be:</div><pre>' + esc(ex.expect) + '</pre>' : '') +
      (store.practice[ex.id] ? '<p><b style="color:#2e7d1e">✔ You solved this one!</b></p>' : '');
    practice.editor.set(store.pcode[ex.id] != null ? store.pcode[ex.id] : ex.starter);
    practice.editor.refresh();
    practice.editor.clearMarks();
    hideMessage($('practice-message'));
    clearOutput($('practice-output'), 'Press Check to run your code.');
  }

  function checkPractice() {
    if (practice.running || !practice.ex) return;
    var ex = practice.ex;
    var code = practice.editor.get();
    var box = $('practice-message');
    var out = $('practice-output');
    practice.running = true;
    $('practice-run').disabled = true;
    practice.editor.clearMarks();
    hideMessage(box);
    clearOutput(out);
    if (pyState !== 'ready') addOutput(out, 'Waking up Python (only the first time)…', 'line-info');
    runner.run({ mode: 'practice', code: code, tests: ex.tests || '' }, 8000).then(function (msg) {
      practice.running = false;
      $('practice-run').disabled = false;
      if (practice.ex !== ex) return;
      clearOutput(out);
      if (msg.timedOut) { showMessage(box, 'error', 'Your code never stops!', 'Check your loops: can they finish?'); return; }
      if (msg.stopped) return;
      var r = msg.practice;
      (r.output || []).forEach(function (line) { addOutput(out, line); });
      if (!(r.output || []).length) addOutput(out, '(nothing was printed)', 'line-info');
      if (r.status === 'error') {
        Sfx.error();
        practice.editor.markError(r.line);
        showMessage(box, 'error', r.title, r.message, r.raw ? '<span class="raw">' + esc(r.raw) + '</span>' : '');
        return;
      }
      if (r.status === 'fail') {
        Sfx.error();
        showMessage(box, 'crash', 'Not quite right yet', r.message);
        return;
      }
      if (ex.expect && normalise((r.output || []).join('\n')) !== normalise(ex.expect)) {
        Sfx.error();
        showMessage(box, 'crash', 'The output is different', 'It should be:', '<pre>' + esc(ex.expect) + '</pre>');
        return;
      }
      var uses = (msg.analysis && msg.analysis.uses) || [];
      var missing = (ex.requires || []).filter(function (q) { return uses.indexOf(q) < 0; });
      if (missing.length) {
        showMessage(box, 'hint', 'Right answer! One more thing…',
          'To finish this puzzle, use ' + missing.map(function (m) { return GameData.REQUIRE_LABELS[m] || m; }).join(' and ') + '.');
        return;
      }
      Sfx.win();
      var first = !store.practice[ex.id];
      store.practice[ex.id] = true;
      save();
      showMessage(box, 'good', first ? 'Solved! Great coding!' : 'Solved again!', 'Press Next to try the next puzzle.');
      renderPracticeList();
    }).catch(function (err) {
      practice.running = false;
      $('practice-run').disabled = false;
      showMessage(box, 'error', 'Python could not start', String(err && err.message || err));
    });
  }

  $('practice-run').addEventListener('click', checkPractice);
  $('practice-hint').addEventListener('click', function () {
    var ex = practice.ex;
    showMessage($('practice-message'), 'hint', 'Hint', '', '<pre>' + esc(ex.hint) + '</pre>');
  });
  $('practice-reset').addEventListener('click', function () {
    practice.editor.set(practice.ex.starter);
    hideMessage($('practice-message'));
  });
  $('practice-solution').addEventListener('click', function () {
    var ex = practice.ex;
    openModal('Show the solution?', '<p>Try on your own first! If you peek, read it carefully and then type it yourself.</p>', [
      { label: 'Show me', green: true, onClick: function () { practice.editor.set(ex.solution); } },
      { label: 'Keep trying' }
    ]);
  });
  $('practice-next').addEventListener('click', function () {
    var i = EX.indexOf(practice.ex);
    location.hash = '#/practice/' + EX[(i + 1) % EX.length].id;
  });

  // ------------------------------------------------------------------
  // Playground
  // ------------------------------------------------------------------
  var playground = { editor: null, running: false };
  var PLAYGROUND_START = '# Try anything you like!\nname = "Pip"\nfor i in range(3):\n    print("Hello from " + name + "!")\n\nprint(2 ** 10)\n';
  function showPlayground() {
    show('view-playground');
    if (!playground.editor) {
      playground.editor = makeEditor($('playground-code'), runPlayground);
      playground.editor.set(store.playground || PLAYGROUND_START);
      playground.editor.onChange(function () { store.playground = playground.editor.get(); save(); });
      clearOutput($('playground-output'), 'Press Run to see the output.');
    }
    playground.editor.refresh();
  }
  function runPlayground() {
    if (playground.running) return;
    var out = $('playground-output');
    var box = $('playground-message');
    playground.running = true;
    $('playground-run').disabled = true;
    playground.editor.clearMarks();
    hideMessage(box);
    clearOutput(out);
    if (pyState !== 'ready') addOutput(out, 'Waking up Python (only the first time)…', 'line-info');
    runner.run({ mode: 'practice', code: playground.editor.get(), tests: '' }, 8000).then(function (msg) {
      playground.running = false;
      $('playground-run').disabled = false;
      clearOutput(out);
      if (msg.timedOut) { showMessage(box, 'error', 'Your code never stops!', 'Python was still busy after 8 seconds.'); return; }
      var r = msg.practice;
      (r.output || []).forEach(function (line) { addOutput(out, line); });
      if (!(r.output || []).length) addOutput(out, '(nothing was printed)', 'line-info');
      if (r.status === 'error') {
        playground.editor.markError(r.line);
        showMessage(box, 'error', r.title, r.message, r.raw ? '<span class="raw">' + esc(r.raw) + '</span>' : '');
      }
    }).catch(function (err) {
      playground.running = false;
      $('playground-run').disabled = false;
      showMessage(box, 'error', 'Python could not start', String(err && err.message || err));
    });
  }
  $('playground-run').addEventListener('click', runPlayground);
  $('playground-clear').addEventListener('click', function () { clearOutput($('playground-output'), 'Output cleared.'); });

  // ------------------------------------------------------------------
  // Start!
  // ------------------------------------------------------------------
  paintTextures();
  updateMuteButtons();
  route();

  // Handy for automated tests and curious teachers.
  window.BlockSnake = {
    runner: runner,
    store: store,
    computeStars: computeStars,
    outputMatches: outputMatches,
    normalise: normalise
  };
})();

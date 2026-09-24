/*
 * The blocky 3D world, drawn with Three.js.
 * Builds a floating island from a level map and replays what the player's
 * code did (the "timeline" made by engine.js).
 */
/* global THREE, BlockTextures, SnakeEngine */
(function (root) {
  'use strict';

  // Face brightness like classic block games: top bright, sides darker.
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z
  var FACE_SHADE = [0.62, 0.62, 1.0, 0.5, 0.8, 0.8];

  var THEMES = {
    plains: { sky: ['#78b7ff', '#cfe8ff'], floor: ['grass_top', 'grass_side'], under: 'dirt', deep: 'stone',
      wall: 'cobble', rock: 'stone', tree: { log: 'log', leaves: 'leaves' } },
    forest: { sky: ['#6aa6e8', '#c4e2ff'], floor: ['grass_dark_top', 'grass_dark_side'], under: 'dirt', deep: 'stone',
      wall: 'mossy_cobble', rock: 'mossy_cobble', tree: { log: 'log', leaves: 'leaves_dark' } },
    desert: { sky: ['#8cc6ff', '#fbe7c0'], floor: ['sand', 'sand'], under: 'sandstone_side', deep: 'sandstone_side',
      wall: 'sandstone', rock: 'sandstone', tree: 'cactus' },
    snow: { sky: ['#9cc9f0', '#eef6ff'], floor: ['snow_top', 'snow_side'], under: 'dirt', deep: 'stone',
      wall: 'stone_bricks', rock: 'stone', tree: { log: 'dark_log', leaves: 'spruce_leaves' } },
    beach: { sky: ['#5fb4ff', '#d8f1ff'], floor: ['sand', 'sand'], under: 'sandstone_side', deep: 'stone',
      wall: 'stone', rock: 'cobble', tree: { log: 'log', leaves: 'leaves' } },
    darkforest: { sky: ['#4b6f96', '#a9c3dc'], floor: ['grass_dark_top', 'grass_dark_side'], under: 'dirt', deep: 'stone',
      wall: 'mossy_cobble', rock: 'cobble', tree: { log: 'dark_log', leaves: 'leaves_dark' } },
    ice: { sky: ['#8fc3f0', '#f0f8ff'], floor: ['packed_ice', 'snow_side'], under: 'dirt', deep: 'stone',
      wall: 'ice', rock: 'packed_ice', tree: { log: 'dark_log', leaves: 'spruce_leaves' } },
    lava: { sky: ['#2a0f14', '#7a2b1c'], floor: ['scorch', 'scorch_side'], under: 'scorch_side', deep: 'obsidian',
      wall: 'obsidian', rock: 'obsidian', tree: { log: 'dark_log', leaves: 'leaves_dark' } }
  };

  // Which texture goes on top / side / bottom of each block kind.
  var BLOCKS = {
    grass_top: null, // floor blocks are built from the theme
    cobble: { all: 'cobble' },
    mossy_cobble: { all: 'mossy_cobble' },
    stone: { all: 'stone' },
    stone_bricks: { all: 'stone_bricks' },
    dirt: { all: 'dirt' },
    sandstone: { top: 'sandstone_top', side: 'sandstone_side', bottom: 'sandstone_top' },
    sandstone_side: { all: 'sandstone_side' },
    scorch_side: { all: 'scorch_side' },
    obsidian: { all: 'obsidian' },
    ice: { all: 'ice', transparent: 0.85 },
    packed_ice: { all: 'packed_ice' },
    log: { top: 'log_top', side: 'log_side', bottom: 'log_top' },
    dark_log: { top: 'dark_log_top', side: 'dark_log_side', bottom: 'dark_log_top' },
    leaves: { all: 'leaves', cutout: true },
    leaves_dark: { all: 'leaves_dark', cutout: true },
    spruce_leaves: { all: 'spruce_leaves', cutout: true },
    cactus: { top: 'cactus_top', side: 'cactus_side', bottom: 'cactus_top' },
    water: { all: 'water', transparent: 0.78, animate: 0.25 },
    lava: { all: 'lava', animate: 0.12 },
    bedrock: { all: 'bedrock' }
  };

  var textureCache = {};
  function texture(name, own) {
    if (!own && textureCache[name]) return textureCache[name];
    var t = new THREE.CanvasTexture(BlockTextures.get(name));
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestMipmapLinearFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (!own) textureCache[name] = t;
    return t;
  }

  var materialCache = {};
  function faceMaterial(texName, shade, opts) {
    opts = opts || {};
    var k = texName + '|' + shade + '|' + (opts.transparent || '') + (opts.cutout ? 'c' : '');
    if (materialCache[k]) return materialCache[k];
    var c = new THREE.Color(shade, shade, shade);
    var m = new THREE.MeshBasicMaterial({ map: texture(texName), color: c });
    if (opts.transparent) { m.transparent = true; m.opacity = opts.transparent; m.depthWrite = false; }
    if (opts.cutout) { m.alphaTest = 0.5; m.side = THREE.DoubleSide; }
    materialCache[k] = m;
    return m;
  }

  function blockMaterials(spec) {
    var top = spec.top || spec.all;
    var side = spec.side || spec.all;
    var bottom = spec.bottom || spec.all || side;
    var names = [side, side, top, bottom, side, side];
    return names.map(function (n, i) { return faceMaterial(n, FACE_SHADE[i], spec); });
  }

  var boxGeo = null;
  function unitBox() {
    if (!boxGeo) boxGeo = new THREE.BoxGeometry(1, 1, 1);
    return boxGeo;
  }

  function WorldView(container, options) {
    options = options || {};
    this.container = container;
    this.options = options;
    this.autoRotate = !!options.autoRotate;
    this.speed = 1;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!options.preserve });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'world-canvas';
    container.appendChild(this.canvas);

    this.bubble = document.createElement('div');
    this.bubble.className = 'speech-bubble';
    this.bubble.hidden = true;
    container.appendChild(this.bubble);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
    this.world = new THREE.Group();
    this.dynamic = new THREE.Group();
    this.scene.add(this.world);
    this.scene.add(this.dynamic);

    this.cam = { az: -0.45, el: 0.95, zoom: 1, target: new THREE.Vector3(), dist: 10, shake: 0 };
    this.particles = [];
    this.apples = {};
    this.segments = [];
    this.liquids = [];
    this.clouds = [];
    this.clock = new THREE.Clock();
    this.time = 0;
    this.anim = null;

    this._setupControls();
    this._resize();
    var self = this;
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(function () { self._resize(); });
      this._ro.observe(container);
    } else {
      window.addEventListener('resize', function () { self._resize(); });
    }
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  WorldView.THEMES = THEMES;

  WorldView.prototype._resize = function () {
    var w = this.container.clientWidth || 1;
    var h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._fitCamera();
  };

  WorldView.prototype._setupControls = function () {
    var self = this;
    var dragging = false, lastX = 0, lastY = 0;
    var pointers = {};
    var pinchStart = 0, zoomStart = 1;
    this.canvas.addEventListener('pointerdown', function (e) {
      pointers[e.pointerId] = [e.clientX, e.clientY];
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      self.canvas.setPointerCapture(e.pointerId);
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinchStart = Math.hypot(a[0] - b[0], a[1] - b[1]);
        zoomStart = self.cam.zoom;
      }
    });
    this.canvas.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId] = [e.clientX, e.clientY];
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinchStart) self.cam.zoom = clamp(zoomStart * pinchStart / d, 0.55, 1.7);
        return;
      }
      if (!dragging) return;
      self.cam.az -= (e.clientX - lastX) * 0.008;
      self.cam.el = clamp(self.cam.el + (e.clientY - lastY) * 0.006, 0.35, 1.45);
      lastX = e.clientX; lastY = e.clientY;
      self.autoRotate = false;
    });
    function up(e) {
      delete pointers[e.pointerId];
      if (!Object.keys(pointers).length) { dragging = false; pinchStart = 0; }
    }
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
    this.canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      self.cam.zoom = clamp(self.cam.zoom * (e.deltaY > 0 ? 1.08 : 0.93), 0.55, 1.7);
    }, { passive: false });
    this.canvas.addEventListener('dblclick', function () { self.resetCamera(); });
  };

  WorldView.prototype.resetCamera = function () {
    this.cam.az = -0.45; this.cam.el = 0.95; this.cam.zoom = 1;
  };

  WorldView.prototype._fitCamera = function () {
    if (!this.layout) return;
    var w = this.layout.width, h = this.layout.height;
    var radius = 0.5 * Math.sqrt(w * w + h * h) + 1.2;
    var half = THREE.MathUtils.degToRad(this.camera.fov / 2);
    var fitH = radius / Math.tan(half);
    var fitW = radius / (Math.tan(half) * this.camera.aspect);
    this.cam.dist = Math.max(fitH, fitW) * 0.92;
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function disposeGroup(group) {
    while (group.children.length) {
      var c = group.children.pop();
      if (c.geometry && c.geometry !== boxGeo) c.geometry.dispose();
    }
  }

  // Build the island for a map. `initial` comes from SnakeEngine.parseMap.
  WorldView.prototype.load = function (initial, themeName) {
    this.cancel();
    disposeGroup(this.world);
    disposeGroup(this.dynamic);
    this.particles = [];
    this.apples = {};
    this.segments = [];
    this.liquids = [];
    this.clouds = [];
    this.bubble.hidden = true;
    this.layout = initial;
    var theme = this.theme = THEMES[themeName] || THEMES.plains;
    this.container.style.background = 'linear-gradient(180deg,' + theme.sky[0] + ' 0%,' + theme.sky[1] + ' 100%)';

    var w = initial.width, h = initial.height;
    this.cam.target.set((w - 1) / 2, -0.4, (h - 1) / 2);
    this._fitCamera();

    var batches = {};
    function add(kind, x, y, z, sx, sy, sz) {
      (batches[kind] = batches[kind] || []).push([x, y, z, sx || 1, sy || 1, sz || 1]);
    }

    var floorKind = 'floor:' + theme.floor[0] + ':' + theme.floor[1];
    BLOCKS[floorKind] = { top: theme.floor[0], side: theme.floor[1], bottom: theme.under };

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var ch = initial.cells[y][x];
        if (ch === ' ') continue;
        if (ch === 'W' || ch === 'L') {
          add(ch === 'W' ? 'water' : 'lava', x, -0.575, y, 1, 0.85, 1);
          add(ch === 'W' ? (theme.floor[0] === 'sand' ? 'sandstone_side' : theme.under) : 'obsidian', x, -1.5, y);
        } else {
          add(floorKind, x, -0.5, y);
          add(theme.under, x, -1.5, y);
        }
        // Island gets thinner towards the bottom, like a floating sky island.
        var edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        if (!edge || ((x + y) % 3 !== 0)) add(theme.deep, x, -2.5, y);
        if (!edge && ((x * 7 + y * 3) % 5 !== 0)) add(theme.deep, x, -3.5, y);

        if (ch === '#') add(theme.wall, x, 0.5, y);
        else if (ch === 'R') add(theme.rock, x, 0.5, y);
        else if (ch === 'C' || (ch === 'T' && theme.tree === 'cactus')) {
          add('cactus', x, 0.5, y, 0.8, 1, 0.8);
          if ((x + y) % 2 === 0) add('cactus', x, 1.35, y, 0.8, 0.7, 0.8);
        } else if (ch === 'T') {
          add(theme.tree.log, x, 0.5, y, 0.7, 1, 0.7);
          add(theme.tree.leaves, x, 1.5, y, 1.15, 1, 1.15);
          add(theme.tree.leaves, x, 2.3, y, 0.7, 0.6, 0.7);
        }
      }
    }

    var self = this;
    var dummy = new THREE.Object3D();
    Object.keys(batches).forEach(function (kind) {
      var spec = BLOCKS[kind];
      if (!spec) return;
      var list = batches[kind];
      var mats = blockMaterials(spec);
      if (spec.animate) {
        mats = mats.map(function (m) {
          var mm = m.clone();
          mm.map = texture(spec.all, true);
          return mm;
        });
        self.liquids.push({ mats: mats, speed: spec.animate });
      }
      var mesh = new THREE.InstancedMesh(unitBox(), mats, list.length);
      list.forEach(function (p, i) {
        dummy.position.set(p[0], p[1], p[2]);
        dummy.scale.set(p[3], p[4], p[5]);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (spec.transparent) mesh.renderOrder = 2;
      self.world.add(mesh);
    });

    this._addClouds(w, h);
    initial.apples.forEach(function (a) { self._addApple(a[0], a[1]); });
    this._buildSnake(initial.snake, initial.facing);
    this.state = { snake: initial.snake.map(function (p) { return p.slice(); }), facing: initial.facing };
  };

  // Clouds drift below the floating island, so they never block the view.
  WorldView.prototype._addClouds = function (w, h) {
    var lava = this.theme === THEMES.lava;
    var mat = new THREE.MeshBasicMaterial({ color: lava ? 0x5a2a2a : 0xffffff, transparent: true, opacity: lava ? 0.55 : 0.85 });
    var span = Math.max(w, h) + 30;
    for (var i = 0; i < 9; i++) {
      var g = new THREE.Group();
      var parts = 2 + (i % 3);
      for (var p = 0; p < parts; p++) {
        var m = new THREE.Mesh(unitBox(), mat);
        m.scale.set(3 + ((i + p) % 3) * 1.5, 0.8, 2.5 + (p % 2) * 1.5);
        m.position.set(p * 2.4, 0, (p % 2) * 1.4);
        g.add(m);
      }
      g.position.set((w - 1) / 2 - span / 2 + ((i * 7) % 9) * span / 9, -8 - (i % 3) * 1.2, (h - 1) / 2 - span / 2 + ((i * 4) % 9) * span / 9);
      g.userData.speed = 0.3 + (i % 3) * 0.12;
      g.userData.span = span;
      g.userData.cx = (w - 1) / 2;
      this.dynamic.add(g);
      this.clouds.push(g);
    }
  };

  WorldView.prototype._addApple = function (x, y) {
    // A sprite always faces the camera, so the apple is easy to see from above.
    var mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture('apple'), alphaTest: 0.5 }));
    mesh.scale.set(0.8, 0.8, 0.8);
    mesh.position.set(x, 0.5, y);
    mesh.userData.phase = (x * 13 + y * 7) % 10;
    var shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(x, 0.01, y);
    this.dynamic.add(mesh);
    this.dynamic.add(shadow);
    this.apples[x + ',' + y] = { mesh: mesh, shadow: shadow };
  };

  WorldView.prototype._snakeMaterials = function (head) {
    var names = head
      ? ['snake_face', 'snake', 'snake_top', 'snake', 'snake', 'snake']
      : ['snake', 'snake', 'snake', 'snake', 'snake', 'snake'];
    return names.map(function (n, i) {
      return new THREE.MeshBasicMaterial({ map: texture(n), color: new THREE.Color(FACE_SHADE[i], FACE_SHADE[i], FACE_SHADE[i]) });
    });
  };

  WorldView.prototype._buildSnake = function (snake, facing) {
    var self = this;
    this.segments.forEach(function (s) { self.dynamic.remove(s); });
    this.segments = [];
    this.snakeMats = { head: this._snakeMaterials(true), body: this._snakeMaterials(false) };
    this.tongue = new THREE.Mesh(unitBox(), new THREE.MeshBasicMaterial({ color: 0xd8262b }));
    this.tongue.scale.set(0.3, 0.05, 0.08);
    this.tongue.visible = false;
    this.dynamic.add(this.tongue);
    for (var i = 0; i < snake.length; i++) this._addSegment(snake[i]);
    this._placeSnake(snake, snake, 1);
    this.segments[0].rotation.y = dirAngle(facing);
  };

  WorldView.prototype._addSegment = function (pos) {
    var isHead = this.segments.length === 0;
    var mesh = new THREE.Mesh(unitBox(), isHead ? this.snakeMats.head : this.snakeMats.body);
    var s = isHead ? 0.92 : 0.8;
    mesh.scale.set(s, s, s);
    mesh.position.set(pos[0], s / 2, pos[1]);
    this.dynamic.add(mesh);
    this.segments.push(mesh);
  };

  function dirAngle(dir) {
    return { right: 0, up: Math.PI / 2, left: Math.PI, down: -Math.PI / 2 }[dir] || 0;
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  WorldView.prototype._placeSnake = function (from, to, t) {
    var n = this.segments.length;
    for (var i = 0; i < n; i++) {
      var a = from[i] || from[from.length - 1];
      var b = to[i] || to[to.length - 1];
      var seg = this.segments[i];
      var size = i === 0 ? 0.92 : (i === n - 1 && n > 2 ? 0.62 : (i % 2 ? 0.8 : 0.76));
      seg.scale.set(size, size, size);
      seg.position.set(a[0] + (b[0] - a[0]) * t, size / 2, a[1] + (b[1] - a[1]) * t);
    }
  };

  WorldView.prototype.setSpeed = function (s) { this.speed = s; };

  WorldView.prototype.cancel = function () {
    if (this.anim && this.anim.reject) {
      var a = this.anim;
      this.anim = null;
      a.resolve({ cancelled: true });
    }
    this.anim = null;
  };

  // Replay a timeline. callbacks: onPrint(text), onEat(), onSay(text), onCrash(crash)
  WorldView.prototype.play = function (timeline, callbacks) {
    var self = this;
    callbacks = callbacks || {};
    this.cancel();
    return new Promise(function (resolve) {
      self.anim = { timeline: timeline, index: -1, step: null, t: 0, callbacks: callbacks, resolve: resolve, reject: true };
      self._nextStep();
    });
  };

  WorldView.prototype._nextStep = function () {
    var a = this.anim;
    if (!a) return;
    a.index++;
    a.t = 0;
    if (a.index >= a.timeline.length) {
      this.anim = null;
      a.resolve({ done: true });
      return;
    }
    var step = a.timeline[a.index];
    a.step = step;
    if (step.kind === 'print') {
      if (a.callbacks.onPrint) a.callbacks.onPrint(step.text);
      a.duration = 0.02;
    } else if (step.kind === 'say') {
      this.showBubble(step.text);
      if (a.callbacks.onSay) a.callbacks.onSay(step.text);
      a.duration = 0.7;
    } else if (step.kind === 'move') {
      a.from = this.state.snake;
      while (this.segments.length < step.snake.length) this._addSegment(a.from[a.from.length - 1]);
      a.fromAngle = this.segments[0].rotation.y;
      var target = dirAngle(step.dir);
      var diff = target - a.fromAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      a.toAngle = a.fromAngle + diff;
      a.duration = 0.28;
    } else if (step.kind === 'crash') {
      a.duration = 0.9;
      if (a.callbacks.onCrash) a.callbacks.onCrash(step.crash);
      this._crashEffect(step.crash, step.dir);
    } else {
      a.duration = 0.01;
    }
  };

  WorldView.prototype._updateAnim = function (dt) {
    var a = this.anim;
    if (!a || !a.step) return;
    a.t += dt * this.speed / a.duration;
    var step = a.step;
    var t = Math.min(a.t, 1);
    if (step.kind === 'move') {
      this._placeSnake(a.from, step.snake, ease(t));
      this.segments[0].rotation.y = a.fromAngle + (a.toAngle - a.fromAngle) * Math.min(1, t * 2);
      if (t >= 1) {
        this.state.snake = step.snake;
        this.state.facing = step.dir;
        if (step.ate) {
          this._eatApple(step.ate);
          if (a.callbacks.onEat) a.callbacks.onEat();
        }
      }
    } else if (step.kind === 'crash') {
      var head = this.segments[0];
      var d = SnakeEngine.DIRS[step.dir] || [0, 0];
      var bump = Math.sin(Math.min(t * 2.5, 1) * Math.PI) * 0.3;
      var h0 = this.state.snake[0];
      head.position.x = h0[0] + d[0] * bump;
      head.position.z = h0[1] + d[1] * bump;
      head.rotation.y = dirAngle(step.dir);
      var flash = Math.floor(t * 8) % 2 === 0 && t < 0.8;
      this._tint(flash ? 0xff6060 : 0xffffff);
    }
    if (a.t >= 1) this._nextStep();
  };

  WorldView.prototype._tint = function (hex) {
    var tint = new THREE.Color(hex);
    ['head', 'body'].forEach(function (k) {
      this.snakeMats[k].forEach(function (m, i) {
        m.color.setRGB(FACE_SHADE[i] * tint.r, FACE_SHADE[i] * tint.g, FACE_SHADE[i] * tint.b);
      });
    }, this);
  };

  WorldView.prototype._eatApple = function (pos) {
    var k = pos[0] + ',' + pos[1];
    var apple = this.apples[k];
    if (!apple) return;
    this.dynamic.remove(apple.mesh);
    this.dynamic.remove(apple.shadow);
    delete this.apples[k];
    this.burst(pos[0], 0.5, pos[1], [0xd8262b, 0xff5a4f, 0x8e1418, 0x3fae3a], 14, 2.5);
  };

  WorldView.prototype._crashEffect = function (crash, dir) {
    this.cam.shake = 0.35;
    var at = crash.at || this.state.snake[0];
    var colors = [0x9a9a9a, 0xcccccc, 0x666666];
    if (crash.block === 'W') colors = [0x3a6be0, 0x8fb8f0, 0xffffff];
    if (crash.block === 'L') colors = [0xff9d1f, 0xd4520c, 0xffd04a, 0x333333];
    if (crash.block === 'T' || crash.block === 'C') colors = [0x3b7d23, 0x6b5031, 0x4a8f2d];
    if (crash.kind === 'tired') { this.showBubble('Zzz...'); return; }
    this.burst(at[0], 0.4, at[1], colors, 18, 3);
  };

  WorldView.prototype.burst = function (x, y, z, colors, count, power) {
    for (var i = 0; i < count; i++) {
      var m = new THREE.Mesh(unitBox(), new THREE.MeshBasicMaterial({ color: colors[i % colors.length] }));
      var s = 0.07 + Math.random() * 0.08;
      m.scale.set(s, s, s);
      m.position.set(x, y, z);
      this.dynamic.add(m);
      this.particles.push({
        mesh: m,
        v: new THREE.Vector3((Math.random() - 0.5) * power, Math.random() * power + 1, (Math.random() - 0.5) * power),
        life: 0.8 + Math.random() * 0.5
      });
    }
  };

  // Party time: colourful blocks and green experience orbs.
  WorldView.prototype.celebrate = function () {
    var self = this;
    var head = this.segments[0] ? this.segments[0].position : new THREE.Vector3();
    var palette = [0xffd23f, 0x5fd14a, 0x3fb4ff, 0xff5a4f, 0xc86bff, 0xffffff];
    for (var k = 0; k < 4; k++) {
      (function (k) {
        setTimeout(function () {
          var cx = self.cam.target.x + (Math.random() - 0.5) * 6;
          var cz = self.cam.target.z + (Math.random() - 0.5) * 4;
          self.burst(cx, 3 + Math.random() * 2, cz, palette, 26, 4);
        }, k * 260);
      })(k);
    }
    for (var i = 0; i < 12; i++) {
      var orb = new THREE.Mesh(unitBox(), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x9bff4f : 0xd7ff5a }));
      orb.scale.set(0.16, 0.16, 0.16);
      orb.position.set(head.x + (Math.random() - 0.5) * 2, 0.3, head.z + (Math.random() - 0.5) * 2);
      this.dynamic.add(orb);
      this.particles.push({ mesh: orb, v: new THREE.Vector3(0, 2 + Math.random() * 2, 0), life: 1.6, orb: true });
    }
  };

  WorldView.prototype.showBubble = function (text) {
    var self = this;
    this.bubble.textContent = text;
    this.bubble.hidden = false;
    clearTimeout(this._bubbleTimer);
    this._bubbleTimer = setTimeout(function () { self.bubble.hidden = true; }, 2200 / Math.max(this.speed, 0.5));
  };

  WorldView.prototype._updateBubble = function () {
    if (this.bubble.hidden || !this.segments[0]) return;
    var p = this.segments[0].position.clone();
    p.y += 0.9;
    p.project(this.camera);
    var w = this.container.clientWidth, h = this.container.clientHeight;
    this.bubble.style.left = ((p.x + 1) / 2 * w) + 'px';
    this.bubble.style.top = ((1 - p.y) / 2 * h) + 'px';
  };

  WorldView.prototype._updateCamera = function (dt) {
    if (this.autoRotate) this.cam.az += dt * 0.12;
    var c = this.cam;
    var d = c.dist * c.zoom;
    var x = c.target.x + d * Math.cos(c.el) * Math.sin(c.az);
    var z = c.target.z + d * Math.cos(c.el) * Math.cos(c.az);
    var y = c.target.y + d * Math.sin(c.el);
    if (c.shake > 0) {
      c.shake = Math.max(0, c.shake - dt);
      x += (Math.random() - 0.5) * c.shake * 0.6;
      y += (Math.random() - 0.5) * c.shake * 0.6;
    }
    this.camera.position.set(x, y, z);
    this.camera.lookAt(c.target);
  };

  WorldView.prototype._loop = function () {
    requestAnimationFrame(this._loop);
    if (this.destroyed) return;
    // Don't waste battery when the view is hidden.
    if (!this.container.offsetParent) { this.clock.getDelta(); return; }
    var dt = Math.min(this.clock.getDelta(), 0.1);
    this.time += dt;
    var t = this.time;

    this._updateAnim(dt);

    var self = this;
    Object.keys(this.apples).forEach(function (k) {
      var a = self.apples[k].mesh;
      a.position.y = 0.5 + Math.sin(t * 2.2 + a.userData.phase) * 0.08;
      a.material.rotation = Math.sin(t * 1.6 + a.userData.phase) * 0.15;
    });

    this.liquids.forEach(function (l) {
      l.mats.forEach(function (m) { m.map.offset.y = (t * l.speed) % 1; });
    });

    this.clouds.forEach(function (c) {
      c.position.x += dt * c.userData.speed;
      if (c.position.x > c.userData.cx + c.userData.span / 2) c.position.x -= c.userData.span;
    });

    for (var i = this.particles.length - 1; i >= 0; i--) {
      var p = this.particles[i];
      p.life -= dt;
      if (p.orb) {
        p.mesh.position.addScaledVector(p.v, dt);
        p.mesh.rotation.y += dt * 4;
      } else {
        p.v.y -= 9 * dt;
        p.mesh.position.addScaledVector(p.v, dt);
        if (p.mesh.position.y < 0.05 && p.v.y < 0) { p.mesh.position.y = 0.05; p.v.multiplyScalar(0.4); p.v.y = 0; }
      }
      if (p.life <= 0) {
        this.dynamic.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    // Tongue flicks out now and then.
    if (this.segments[0] && this.tongue) {
      var flick = (t % 3.2) < 0.35 && !(this.anim && this.anim.step && this.anim.step.kind === 'crash');
      this.tongue.visible = flick;
      if (flick) {
        var head = this.segments[0];
        var ang = head.rotation.y;
        var out = 0.55 + Math.sin(((t % 3.2) / 0.35) * Math.PI) * 0.12;
        this.tongue.position.set(head.position.x + Math.cos(ang) * out, 0.22, head.position.z - Math.sin(ang) * out);
        this.tongue.rotation.y = ang;
      }
    }
    if (!this.anim && this.snakeMats) this._tint(0xffffff);

    this._updateCamera(dt);
    this._updateBubble();
    this.renderer.render(this.scene, this.camera);
  };

  WorldView.prototype.destroy = function () {
    this.destroyed = true;
    this.cancel();
    if (this._ro) this._ro.disconnect();
    this.renderer.dispose();
  };

  root.WorldView = WorldView;
})(window);

/*
 * Hand-made 16x16 pixel textures, drawn with code.
 * Every block, the snake and the apple are generated here (no image files).
 */
(function (root) {
  'use strict';

  var SIZE = 16;
  var cache = {};

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(name) {
    var h = 2166136261;
    for (var i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w || SIZE;
    c.height = h || SIZE;
    return c;
  }

  function px(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }

  function pick(rnd, list) { return list[Math.floor(rnd() * list.length)]; }

  function noise(ctx, rnd, palette, x0, y0, w, h) {
    x0 = x0 || 0; y0 = y0 || 0; w = w || SIZE; h = h || SIZE;
    for (var y = y0; y < y0 + h; y++) {
      for (var x = x0; x < x0 + w; x++) px(ctx, x, y, pick(rnd, palette));
    }
  }

  function sprinkle(ctx, rnd, palette, chance) {
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) if (rnd() < chance) px(ctx, x, y, pick(rnd, palette));
    }
  }

  // ---- palettes ----
  var P = {
    grass: ['#5d9c3a', '#6aad43', '#4f8a31', '#78bb4d', '#5a9637', '#66a83f'],
    grassDark: ['#3f7a2a', '#4a8a31', '#356b23', '#528f37', '#3b7027'],
    dirt: ['#866043', '#79553a', '#96704f', '#6b4a31', '#8c6a4b', '#7d5a3f'],
    stone: ['#7d7d7d', '#8a8a8a', '#737373', '#6b6b6b', '#939393', '#808080'],
    sand: ['#dbd3a0', '#e3dbb0', '#d4c98f', '#e8e0b8', '#d9cf98'],
    sandstone: ['#d8cb8d', '#cfc07c', '#e0d49b', '#c9b873'],
    snow: ['#f0fafa', '#ffffff', '#e4f0f2', '#dde9ec', '#f6fbfc'],
    ice: ['#8fb8f0', '#9cc4f5', '#a9cffa', '#84acea', '#b7d8fb'],
    bark: ['#6b5031', '#5a4228', '#7a5c39', '#4d3920'],
    barkDark: ['#3d2a18', '#33230f', '#4a3420', '#2b1d0e'],
    wood: ['#b08d57', '#a07e4b', '#bd9a62'],
    leaves: ['#3b7d23', '#2f6b1b', '#4a8f2d', '#256015', '#418726'],
    leavesDark: ['#2b4f20', '#23421a', '#34602a', '#1c3714'],
    spruce: ['#2f4f2f', '#27452a', '#3a5c38', '#223d24'],
    cactus: ['#3f8a2e', '#377c28', '#469634'],
    water: ['#2f5fd0', '#3a6be0', '#2a55c0', '#3462d6'],
    lava: ['#d4520c', '#e86a10', '#f08318', '#c2410b', '#e35d0e'],
    scorch: ['#6e2a2a', '#7d3030', '#5c2222', '#8a3a35', '#662626'],
    obsidian: ['#15101f', '#1e1630', '#191226', '#110c19'],
    snake: ['#4caf3f', '#55b847', '#46a53a', '#5cbf4c'],
    snakeDark: ['#2f7d2a', '#2a7026', '#348a2e'],
    belly: ['#d7e86a', '#c9dc5c', '#e2f07a']
  };

  // ---- block recipes ----
  var RECIPES = {
    grass_top: function (ctx, r) { noise(ctx, r, P.grass); sprinkle(ctx, r, ['#86c95a', '#4a8230'], 0.06); },
    grass_side: function (ctx, r) { grassySide(ctx, r, P.grass, P.dirt); },
    grass_dark_top: function (ctx, r) { noise(ctx, r, P.grassDark); sprinkle(ctx, r, ['#5a9a3c', '#2d5e1f'], 0.07); },
    grass_dark_side: function (ctx, r) { grassySide(ctx, r, P.grassDark, P.dirt); },
    dirt: function (ctx, r) { noise(ctx, r, P.dirt); sprinkle(ctx, r, ['#a1a1a1', '#5c3f29'], 0.03); },
    stone: function (ctx, r) {
      noise(ctx, r, P.stone);
      for (var i = 0; i < 6; i++) {
        var x = Math.floor(r() * 14), y = Math.floor(r() * 16);
        px(ctx, x, y, '#5f5f5f'); px(ctx, x + 1, y, '#666666');
      }
    },
    cobble: function (ctx, r) { cobble(ctx, r, P.stone, null); },
    mossy_cobble: function (ctx, r) { cobble(ctx, r, P.stone, ['#4f7a32', '#5d8c3a', '#43692a']); },
    stone_bricks: function (ctx, r) { bricks(ctx, r, P.stone, '#4d4d4d', '#9a9a9a'); },
    sand: function (ctx, r) { noise(ctx, r, P.sand); sprinkle(ctx, r, ['#c7bb82'], 0.05); },
    sandstone_side: function (ctx, r) {
      noise(ctx, r, P.sandstone);
      for (var x = 0; x < SIZE; x++) {
        px(ctx, x, 0, '#e6dcaa'); px(ctx, x, 1, '#e0d49b');
        px(ctx, x, 5, '#bfae6c'); px(ctx, x, 10, '#c4b371');
        px(ctx, x, 14, '#b8a764'); px(ctx, x, 15, '#b3a25f');
      }
    },
    sandstone_top: function (ctx, r) { noise(ctx, r, ['#e0d49b', '#dccf93', '#e6dba7']); },
    snow_top: function (ctx, r) { noise(ctx, r, P.snow); },
    snow_side: function (ctx, r) {
      noise(ctx, r, P.dirt);
      for (var x = 0; x < SIZE; x++) {
        var d = 3 + (r() < 0.5 ? 1 : 0) + (r() < 0.3 ? 1 : 0);
        for (var y = 0; y < d; y++) px(ctx, x, y, pick(r, P.snow));
      }
    },
    ice: function (ctx, r) {
      noise(ctx, r, P.ice);
      for (var i = 0; i < 3; i++) {
        var sx = Math.floor(r() * 16), sy = Math.floor(r() * 16);
        for (var k = 0; k < 5; k++) px(ctx, (sx + k) % 16, (sy + k) % 16, '#dcecff');
      }
    },
    packed_ice: function (ctx, r) {
      noise(ctx, r, ['#a4c6f0', '#b3d1f5', '#98bdea', '#bcd7f7']);
      sprinkle(ctx, r, ['#e2efff'], 0.05);
    },
    log_side: function (ctx, r) { logSide(ctx, r, P.bark); },
    log_top: function (ctx, r) { logTop(ctx, r, P.bark, P.wood); },
    dark_log_side: function (ctx, r) { logSide(ctx, r, P.barkDark); },
    dark_log_top: function (ctx, r) { logTop(ctx, r, P.barkDark, ['#6b4a2b', '#5c3e22', '#7a5634']); },
    leaves: function (ctx, r) { leaves(ctx, r, P.leaves); },
    leaves_dark: function (ctx, r) { leaves(ctx, r, P.leavesDark); },
    spruce_leaves: function (ctx, r) { leaves(ctx, r, P.spruce); sprinkle(ctx, r, ['#ffffff', '#eef6f7'], 0.12); },
    cactus_side: function (ctx, r) {
      noise(ctx, r, P.cactus);
      for (var y = 0; y < SIZE; y++) {
        [0, 15].forEach(function (x) { px(ctx, x, y, '#2a5f1f'); });
        [4, 11].forEach(function (x) { px(ctx, x, y, '#2f6b22'); });
      }
      for (var i = 0; i < 10; i++) px(ctx, 1 + Math.floor(r() * 14), Math.floor(r() * 16), '#e3eeb0');
    },
    cactus_top: function (ctx, r) {
      noise(ctx, r, P.cactus);
      ctx.fillStyle = '#5aa845'; ctx.fillRect(3, 3, 10, 10);
      ctx.fillStyle = '#3f8a2e'; ctx.fillRect(5, 5, 6, 6);
    },
    water: function (ctx, r) {
      noise(ctx, r, P.water);
      for (var y = 1; y < SIZE; y += 4) {
        var x0 = Math.floor(r() * 16);
        for (var k = 0; k < 5; k++) px(ctx, (x0 + k) % 16, y, '#5b8cf0');
      }
    },
    lava: function (ctx, r) {
      noise(ctx, r, P.lava);
      for (var i = 0; i < 7; i++) {
        var x = Math.floor(r() * 15), y = Math.floor(r() * 15);
        ctx.fillStyle = pick(r, ['#ffb52e', '#ffd04a', '#ff9d1f']);
        ctx.fillRect(x, y, 2, 2);
      }
      sprinkle(ctx, r, ['#9c2f08'], 0.05);
    },
    scorch: function (ctx, r) {
      noise(ctx, r, P.scorch);
      sprinkle(ctx, r, ['#4a1818', '#9c4a3c'], 0.08);
    },
    scorch_side: function (ctx, r) { noise(ctx, r, P.scorch); sprinkle(ctx, r, ['#4a1818'], 0.1); },
    obsidian: function (ctx, r) {
      noise(ctx, r, P.obsidian);
      for (var i = 0; i < 6; i++) {
        var x = Math.floor(r() * 14), y = Math.floor(r() * 15);
        px(ctx, x, y, '#3b2a63'); px(ctx, x + 1, y, '#4c3880'); px(ctx, x + 1, y + 1, '#2c1f4a');
      }
    },
    planks: function (ctx, r) {
      noise(ctx, r, ['#a07e4b', '#b08d57', '#9a7746', '#a98552']);
      for (var x = 0; x < SIZE; x++) { px(ctx, x, 3, '#6e5230'); px(ctx, x, 7, '#6e5230'); px(ctx, x, 11, '#6e5230'); px(ctx, x, 15, '#6e5230'); }
      [[5, 0], [12, 4], [2, 8], [9, 12]].forEach(function (p) { for (var y = p[1]; y < p[1] + 3; y++) px(ctx, p[0], y, '#6e5230'); });
    },
    bedrock: function (ctx, r) { noise(ctx, r, ['#3a3a3a', '#555555', '#2a2a2a', '#6a6a6a', '#1f1f1f']); },
    snake: function (ctx, r) { snakeSkin(ctx, r); },
    snake_top: function (ctx, r) {
      snakeSkin(ctx, r);
      // eyes near the front (+x is the right side of the image)
      eye(ctx, 10, 2); eye(ctx, 10, 11);
      px(ctx, 14, 6, '#1f4d1a'); px(ctx, 14, 9, '#1f4d1a');
    },
    snake_face: function (ctx, r) {
      snakeSkin(ctx, r);
      eye(ctx, 2, 4); eye(ctx, 11, 4);
      px(ctx, 6, 10, '#173d13'); px(ctx, 9, 10, '#173d13');
      for (var x = 3; x < 13; x++) px(ctx, x, 13, '#1f4d1a');
    },
    snake_tail: function (ctx, r) { snakeSkin(ctx, r); },
    cloud: function (ctx) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 16, 16); }
  };

  function eye(ctx, x, y) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 3, 3);
    ctx.fillStyle = '#111111'; ctx.fillRect(x + 1, y + 1, 2, 2);
  }

  function snakeSkin(ctx, r) {
    noise(ctx, r, P.snake);
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        if ((x + y) % 6 === 0 || (x - y + 18) % 6 === 0) px(ctx, x, y, pick(r, P.snakeDark));
      }
    }
    sprinkle(ctx, r, ['#7fd96a'], 0.05);
  }

  function grassySide(ctx, r, top, dirt) {
    noise(ctx, r, dirt);
    for (var x = 0; x < SIZE; x++) {
      var d = 3 + (r() < 0.55 ? 1 : 0) + (r() < 0.25 ? 1 : 0);
      for (var y = 0; y < d; y++) px(ctx, x, y, pick(r, top));
    }
  }

  function cobble(ctx, r, palette, moss) {
    var seeds = [];
    for (var i = 0; i < 9; i++) seeds.push([r() * 16, r() * 16, pick(r, ['#8f8f8f', '#7a7a7a', '#999999', '#858585'])]);
    var owner = [];
    for (var y = 0; y < SIZE; y++) {
      owner.push([]);
      for (var x = 0; x < SIZE; x++) {
        var best = 0, bd = 1e9;
        for (var s = 0; s < seeds.length; s++) {
          var dx = Math.abs(x - seeds[s][0]); dx = Math.min(dx, 16 - dx);
          var dy = Math.abs(y - seeds[s][1]); dy = Math.min(dy, 16 - dy);
          var d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = s; }
        }
        owner[y].push(best);
      }
    }
    for (var yy = 0; yy < SIZE; yy++) {
      for (var xx = 0; xx < SIZE; xx++) {
        var o = owner[yy][xx];
        var edge = owner[yy][(xx + 1) % 16] !== o || owner[(yy + 1) % 16][xx] !== o;
        if (edge) px(ctx, xx, yy, r() < 0.5 ? '#4e4e4e' : '#555555');
        else if (moss && r() < 0.3) px(ctx, xx, yy, pick(r, moss));
        else px(ctx, xx, yy, r() < 0.7 ? seeds[o][2] : pick(r, palette));
      }
    }
  }

  function bricks(ctx, r, palette, mortar, light) {
    noise(ctx, r, palette);
    for (var row = 0; row < 4; row++) {
      var y = row * 4 + 3;
      for (var x = 0; x < SIZE; x++) px(ctx, x, y, mortar);
      var off = row % 2 ? 4 : 0;
      for (var b = off; b < SIZE + 8; b += 8) {
        for (var yy = row * 4; yy < row * 4 + 3; yy++) px(ctx, (b + 15) % 16, yy, mortar);
        px(ctx, b % 16, row * 4, light);
      }
    }
  }

  function logSide(ctx, r, bark) {
    for (var x = 0; x < SIZE; x++) {
      var base = pick(r, bark);
      for (var y = 0; y < SIZE; y++) px(ctx, x, y, r() < 0.8 ? base : pick(r, bark));
    }
  }

  function logTop(ctx, r, bark, wood) {
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        var d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        if (d > 6.5) px(ctx, x, y, pick(r, bark));
        else px(ctx, x, y, Math.floor(d) % 2 ? wood[0] : (wood[1] || wood[0]));
      }
    }
  }

  function leaves(ctx, r, palette) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        if (r() < 0.14) continue; // little holes like real leaves
        px(ctx, x, y, pick(r, palette));
      }
    }
  }

  // ---- pixel-art sprites (letters map to colours) ----
  var SPRITES = {
    apple: {
      colors: { r: '#d8262b', R: '#ff5a4f', W: '#ffe0d8', d: '#8e1418', s: '#5b3a1a', l: '#3fae3a', L: '#2a7d26' },
      rows: [
        '................',
        '........s.......',
        '.......s.ll.....',
        '.......slLll....',
        '....rrrsrrr.....',
        '...rRRrrrrrr....',
        '..rRWRrrrrrrr...',
        '..rRWrrrrrrrrd..',
        '..rRrrrrrrrrrd..',
        '..rrrrrrrrrrrd..',
        '..rrrrrrrrrrdd..',
        '...rrrrrrrrdd...',
        '...drrrrrrrdd...',
        '....ddrrrdd.....',
        '.....dd.dd......',
        '................'
      ]
    },
    'arrow-right': {
      colors: { k: '#1d3b12', g: '#5fd14a', G: '#8ff27a' },
      rows: [
        '................',
        '................',
        '.........k......',
        '.........kk.....',
        '.........kgk....',
        '..kkkkkkkkggk...',
        '..kGGGGGGGgggk..',
        '..kggggggggggk..',
        '..kkkkkkkkggk...',
        '.........kgk....',
        '.........kk.....',
        '.........k......',
        '................',
        '................',
        '................',
        '................'
      ]
    },
    boots: {
      colors: { k: '#2b1a0c', b: '#8b5a2b', B: '#a8733d', s: '#cfcfcf' },
      rows: [
        '................',
        '................',
        '...kkkkk........',
        '...kBbbk........',
        '...kBbbk........',
        '...kBbbk........',
        '...kBbbk........',
        '...kBbbkkkkk....',
        '...kBbbbbbbbk...',
        '...kBbbbbbbbbk..',
        '...kbbbbbbbbbk..',
        '...kssssssssk...',
        '...kkkkkkkkkk...',
        '................',
        '................',
        '................'
      ]
    },
    star: {
      colors: { k: '#5a3d00', y: '#ffd23f', Y: '#fff29a', o: '#e0a200' },
      rows: [
        '................',
        '.......kk.......',
        '......kyyk......',
        '......kYyk......',
        '.....kyYyyk.....',
        'kkkkkkyyyyykkkkk',
        'kyyyyyyyyyyyyyyk',
        '.kyyyyyyyyyyyyk.',
        '..kyyyyyyyyyyk..',
        '...kyyyyyyyyk...',
        '...kyyyyyyyyk...',
        '..kyyyyokyyyyk..',
        '..kyyyok.kyyyk..',
        '.kyyok....koyyk.',
        '.kkk........kkk.',
        '................'
      ]
    },
    lock: {
      colors: { k: '#1c1c1c', g: '#9a9a9a', G: '#c8c8c8', y: '#d9a400', Y: '#ffd23f' },
      rows: [
        '................',
        '................',
        '.....kkkkkk.....',
        '....kGGGGGGk....',
        '....kGk..kGk....',
        '....kgk..kgk....',
        '....kgk..kgk....',
        '...kkkkkkkkkk...',
        '...kYYYYYYYYk...',
        '...kYyyykyyyk...',
        '...kYyykkkyyk...',
        '...kYyyykyyyk...',
        '...kyyyyyyyyk...',
        '...kkkkkkkkkk...',
        '................',
        '................'
      ]
    },
    heart: {
      colors: { k: '#3a0000', r: '#e0262b', R: '#ff8080' },
      rows: [
        '................',
        '................',
        '..kkkk....kkkk..',
        '.kRRrrk..krrrrk.',
        'kRRrrrrkkrrrrrrk',
        'kRrrrrrrrrrrrrrk',
        'krrrrrrrrrrrrrrk',
        'krrrrrrrrrrrrrrk',
        '.krrrrrrrrrrrrk.',
        '..krrrrrrrrrrk..',
        '...krrrrrrrrk...',
        '....krrrrrrk....',
        '.....krrrrk.....',
        '......krrk......',
        '.......kk.......',
        '................'
      ]
    }
  };

  function sprite(name) {
    var s = SPRITES[name];
    var c = canvas();
    var ctx = c.getContext('2d');
    s.rows.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) {
        var ch = row[x];
        if (ch !== '.' && s.colors[ch]) px(ctx, x, y, s.colors[ch]);
      }
    });
    return c;
  }

  function get(name) {
    if (cache[name]) return cache[name];
    var c;
    if (SPRITES[name]) {
      c = sprite(name);
    } else {
      var recipe = RECIPES[name];
      if (!recipe) throw new Error('No texture called ' + name);
      c = canvas();
      recipe(c.getContext('2d'), rng(hashSeed(name)));
    }
    cache[name] = c;
    return c;
  }

  // A bigger picture for CSS backgrounds (pixels stay sharp).
  function dataURL(name, scale, darken) {
    var src = get(name);
    scale = scale || 4;
    var c = canvas(SIZE * scale, SIZE * scale);
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, c.width, c.height);
    if (darken) {
      ctx.fillStyle = 'rgba(0,0,0,' + darken + ')';
      ctx.fillRect(0, 0, c.width, c.height);
    }
    return c.toDataURL();
  }

  // A little 3D-looking block picture, like an inventory icon.
  function blockIcon(top, side, size) {
    size = size || 64;
    var c = canvas(size, size);
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    var t = get(top), s = get(side);
    var h = size / 2, q = size / 4;
    function face(img, a, b, cc, shade) {
      ctx.save();
      ctx.transform(a[0], a[1], b[0], b[1], cc[0], cc[1]);
      ctx.drawImage(img, 0, 0, 16, 16, 0, 0, 1, 1);
      ctx.fillStyle = 'rgba(0,0,0,' + shade + ')';
      ctx.fillRect(0, 0, 1, 1);
      ctx.restore();
    }
    // top
    face(t, [h, -q], [h, q], [0, q], 0);
    // left
    face(s, [h, q], [0, h], [0, q], 0.2);
    // right
    face(s, [h, -q], [0, h], [h, h], 0.4);
    return c;
  }

  root.BlockTextures = { get: get, dataURL: dataURL, blockIcon: blockIcon, SIZE: SIZE };
})(window);

/*
 * BlockSnake game engine.
 * Pure logic, no drawing. Used by the Python worker (to run the player's code)
 * and by the page (to know the starting layout of a level).
 *
 * Map legend:
 *   .  grass / floor        S  snake start (head)      A  apple
 *   #  wall block           T  tree                    R  rock
 *   C  cactus               W  water                   L  lava
 *   (space) empty sky - the snake falls off!
 */
function SnakeEngineFactory(root) {
  'use strict';

  var DIRS = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0]
  };
  var DIR_NAMES = ['up', 'down', 'left', 'right'];

  var SOLID = {
    '#': 'bumped into a wall block',
    T: 'bonked into a tree',
    R: 'bumped into a rock',
    C: 'got poked by a cactus. Ouch!',
    W: 'fell in the water. Splash! Snakes here can’t swim',
    L: 'touched hot lava. Too hot!'
  };

  var START_LENGTH = 3;
  var DEFAULT_MOVE_LIMIT = 400;

  function key(x, y) { return x + ',' + y; }

  // Small seeded random generator so "random" levels can be repeated.
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function parseMap(rows, opts) {
    opts = opts || {};
    var height = rows.length;
    var width = 0;
    rows.forEach(function (r) { width = Math.max(width, r.length); });
    var cells = [];
    var apples = [];
    var head = null;
    for (var y = 0; y < height; y++) {
      var line = [];
      for (var x = 0; x < width; x++) {
        var ch = rows[y][x] === undefined ? ' ' : rows[y][x];
        if (ch === 'A') { apples.push([x, y]); ch = '.'; }
        if (ch === 'S') { head = [x, y]; ch = '.'; }
        line.push(ch);
      }
      cells.push(line);
    }
    if (!head) throw new Error('Map has no snake (S)');

    if (opts.randomApples) {
      var rnd = mulberry32(opts.seed || 1);
      var free = [];
      for (var yy = 0; yy < height; yy++) {
        for (var xx = 0; xx < width; xx++) {
          if (cells[yy][xx] === '.' && !(xx === head[0] && yy === head[1])) free.push([xx, yy]);
        }
      }
      for (var i = 0; i < opts.randomApples && free.length; i++) {
        var idx = Math.floor(rnd() * free.length);
        apples.push(free.splice(idx, 1)[0]);
      }
    }

    var snake = [];
    var len = opts.startLength || START_LENGTH;
    for (var s = 0; s < len; s++) snake.push([head[0], head[1]]);

    return {
      width: width,
      height: height,
      cells: cells,
      apples: apples,
      snake: snake,
      facing: opts.facing || 'right'
    };
  }

  function createGame(rows, opts) {
    opts = opts || {};
    var initial = parseMap(rows, opts);
    var width = initial.width;
    var height = initial.height;
    var cells = initial.cells;
    var apples = {};
    initial.apples.forEach(function (a) { apples[key(a[0], a[1])] = true; });
    var appleCount = initial.apples.length;
    var snake = initial.snake.map(function (p) { return p.slice(); });
    var facing = initial.facing;
    var moveLimit = opts.moveLimit || DEFAULT_MOVE_LIMIT;
    var moves = 0;
    var eaten = 0;
    var crash = null;
    var timeline = [];

    function cellAt(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return ' ';
      return cells[y][x];
    }

    function occupiedByBody(x, y, growing) {
      // When not growing, the last tail segment moves away this turn.
      var end = growing ? snake.length : snake.length - 1;
      for (var i = 0; i < end; i++) {
        if (snake[i][0] === x && snake[i][1] === y) return true;
      }
      return false;
    }

    function blockedReason(dir) {
      var d = DIRS[dir];
      var nx = snake[0][0] + d[0];
      var ny = snake[0][1] + d[1];
      var ch = cellAt(nx, ny);
      if (ch === ' ') return { kind: 'edge', text: 'fell off the edge of the world', at: [nx, ny] };
      if (SOLID[ch]) return { kind: 'block', block: ch, text: SOLID[ch], at: [nx, ny] };
      var growing = !!apples[key(nx, ny)];
      if (occupiedByBody(nx, ny, growing)) {
        return { kind: 'self', text: 'bit its own tail! Snakes can’t go through their body', at: [nx, ny] };
      }
      return null;
    }

    function move(dir) {
      if (crash) return crash.text;
      if (!DIRS[dir]) return 'does not know the direction "' + dir + '"';
      if (moves >= moveLimit) {
        crash = { kind: 'tired', text: 'got too tired after ' + moveLimit + ' moves. Is your loop stopping?', at: snake[0].slice() };
        timeline.push({ kind: 'crash', crash: crash, dir: dir });
        return crash.text;
      }
      var reason = blockedReason(dir);
      if (reason) {
        crash = reason;
        facing = dir;
        timeline.push({ kind: 'crash', crash: crash, dir: dir });
        return crash.text;
      }
      var d = DIRS[dir];
      var nx = snake[0][0] + d[0];
      var ny = snake[0][1] + d[1];
      var k = key(nx, ny);
      var ate = null;
      snake.unshift([nx, ny]);
      if (apples[k]) {
        delete apples[k];
        eaten++;
        ate = [nx, ny];
      } else {
        snake.pop();
      }
      moves++;
      facing = dir;
      timeline.push({
        kind: 'move',
        dir: dir,
        snake: snake.map(function (p) { return p.slice(); }),
        ate: ate
      });
      return null;
    }

    function canMove(dir) {
      if (!DIRS[dir] || crash) return false;
      return !blockedReason(dir);
    }

    function applesLeft() { return appleCount - eaten; }

    // Direction of the closest apple (as the crow flies).
    function appleDirection() {
      var hx = snake[0][0];
      var hy = snake[0][1];
      var best = null;
      var bestDist = Infinity;
      Object.keys(apples).forEach(function (k) {
        var p = k.split(',').map(Number);
        var dist = Math.abs(p[0] - hx) + Math.abs(p[1] - hy);
        if (dist < bestDist || (dist === bestDist && (p[1] < best[1] || (p[1] === best[1] && p[0] < best[0])))) {
          bestDist = dist;
          best = p;
        }
      });
      if (!best) return 'none';
      var dx = best[0] - hx;
      var dy = best[1] - hy;
      if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
      return dy > 0 ? 'down' : 'up';
    }

    function say(text) {
      timeline.push({ kind: 'say', text: String(text).slice(0, 80) });
    }

    function print(text) {
      timeline.push({ kind: 'print', text: String(text) });
    }

    function result() {
      return {
        crashed: !!crash,
        crash: crash,
        applesLeft: applesLeft(),
        applesTotal: appleCount,
        eaten: eaten,
        moves: moves,
        won: !crash && applesLeft() === 0,
        head: snake[0].slice(),
        length: snake.length
      };
    }

    return {
      initial: initial,
      move: move,
      canMove: canMove,
      applesLeft: applesLeft,
      appleDirection: appleDirection,
      say: say,
      print: print,
      result: result,
      timeline: timeline
    };
  }

  var api = {
    DIRS: DIRS,
    DIR_NAMES: DIR_NAMES,
    SOLID: SOLID,
    parseMap: parseMap,
    createGame: createGame
  };

  root.SnakeEngine = api;
  return api;
}

// The Python worker gets its own copy of this factory (see runner.js).
SnakeEngineFactory(typeof self !== 'undefined' ? self : this);
if (typeof module !== 'undefined' && module.exports) module.exports = this.SnakeEngine || self.SnakeEngine;

// Runs every level solution and every practice solution through the real
// Python-in-the-browser worker, plus a few "wrong code" checks and screenshots.
//
//   npm install && npm test
//
// CDN files (Pyodide, Three.js, CodeMirror) are served from node_modules so the
// test works offline.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NM = path.join(ROOT, 'node_modules');
const OUT = path.join(ROOT, 'test-output');
fs.mkdirSync(OUT, { recursive: true });

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.wasm': 'application/wasm', '.zip': 'application/zip', '.png': 'image/png'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (url.pathname === '/') file = path.join(ROOT, 'index.html');
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const CDN = [
  [/^https:\/\/cdn\.jsdelivr\.net\/pyodide\/v0\.26\.4\/full\/(.+)$/, (m) => path.join(NM, 'pyodide', m[1])],
  [/three\.js\/r128\/three\.min\.js$/, () => path.join(NM, 'three/build/three.min.js')],
  [/codemirror\/5\.65\.16\/codemirror\.min\.js$/, () => path.join(NM, 'codemirror/lib/codemirror.js')],
  [/codemirror\/5\.65\.16\/codemirror\.min\.css$/, () => path.join(NM, 'codemirror/lib/codemirror.css')],
  [/codemirror\/5\.65\.16\/mode\/python\/python\.min\.js$/, () => path.join(NM, 'codemirror/mode/python/python.js')],
  [/codemirror\/5\.65\.16\/addon\/edit\/matchbrackets\.min\.js$/, () => path.join(NM, 'codemirror/addon/edit/matchbrackets.js')]
];

async function routeCdn(context) {
  await context.route(/^https:\/\//, async (route) => {
    const url = route.request().url();
    for (const [re, map] of CDN) {
      const m = url.match(re);
      if (m) {
        const file = map(m);
        if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'missing ' + file });
        return route.fulfill({
          status: 200,
          body: fs.readFileSync(file),
          headers: { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'access-control-allow-origin': '*' }
        });
      }
    }
    return route.abort(); // fonts etc. are optional
  });
}

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
await routeCdn(context);
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) pageErrors.push('console: ' + m.text()); });

let failures = 0;
function check(ok, label, detail) {
  if (ok) console.log('  ok   ' + label);
  else { failures++; console.log('  FAIL ' + label + (detail ? '\n       ' + detail : '')); }
}

await page.goto(BASE + '/index.html#/');
await page.waitForFunction(() => window.BlockSnake, null, { timeout: 30000 });
console.log('Waiting for Python to load...');
await page.waitForFunction(() => document.querySelector('.py-status.ready'), null, { timeout: 180000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, '01-home.png') });

// ---------- Levels ----------
console.log('\nLevels:');
const levelResults = await page.evaluate(async () => {
  const out = [];
  for (const l of GameData.LEVELS) {
    const msg = await BlockSnake.runner.run({ mode: 'level', code: l.solution, maps: l.maps, options: {} }, 20000);
    const runs = msg.runs || [];
    const allWon = runs.length === l.maps.length && runs.every((r) => r.status === 'ok' && r.result.won);
    const outputOk = !l.expectOutput || BlockSnake.outputMatches(runs, l.expectOutput);
    const stars = BlockSnake.computeStars(l, msg.analysis || { uses: [], lines: 0 });
    // The starting code should NOT already solve the level.
    const s = await BlockSnake.runner.run({ mode: 'level', code: l.starter, maps: l.maps, options: {} }, 20000);
    const starterWins = (s.runs || []).length === l.maps.length && s.runs.every((r) => r.status === 'ok' && r.result.won) &&
      (!l.expectOutput || BlockSnake.outputMatches(s.runs, l.expectOutput));
    out.push({
      id: l.id, title: l.title, allWon, outputOk, stars: stars.stars, missing: stars.missing, lines: stars.lines, par: l.par,
      starterWins,
      detail: runs.map((r) => r.status + (r.error ? ':' + r.error.title + ' ' + r.error.message : '') +
        (r.result && r.result.crash ? ':' + r.result.crash.text : '') + (r.result ? ' left=' + r.result.applesLeft : '')).join(' | ')
    });
  }
  return out;
});
for (const r of levelResults) {
  check(r.allWon && r.outputOk && r.stars === 3 && !r.starterWins,
    `Level ${r.id} "${r.title}" solution wins with 3 stars`,
    `won=${r.allWon} output=${r.outputOk} stars=${r.stars} missing=${r.missing} lines=${r.lines}/${r.par} starterWins=${r.starterWins} :: ${r.detail}`);
}

// ---------- Free play ----------
const free = await page.evaluate(async () => {
  const l = GameData.FREE_PLAY;
  const msg = await BlockSnake.runner.run({ mode: 'level', code: l.starter, maps: l.maps, options: { randomApples: 12, seed: 5, moveLimit: 1000 } });
  return msg.runs[0].status;
});
check(free === 'ok', 'Free play starter code runs', free);

// ---------- Practice ----------
console.log('\nPractice:');
const practiceResults = await page.evaluate(async () => {
  const out = [];
  for (const ex of PracticeData.EXERCISES) {
    const msg = await BlockSnake.runner.run({ mode: 'practice', code: ex.solution, tests: ex.tests || '' });
    const r = msg.practice;
    const outputOk = !ex.expect || BlockSnake.normalise(r.output.join('\n')) === BlockSnake.normalise(ex.expect);
    const uses = msg.analysis.uses;
    const missing = (ex.requires || []).filter((q) => uses.indexOf(q) < 0);
    const s = await BlockSnake.runner.run({ mode: 'practice', code: ex.starter, tests: ex.tests || '' });
    const sr = s.practice;
    const starterPasses = sr.status === 'ok' && (!ex.expect || BlockSnake.normalise(sr.output.join('\n')) === BlockSnake.normalise(ex.expect)) &&
      (ex.requires || []).every((q) => s.analysis.uses.indexOf(q) >= 0);
    out.push({ id: ex.id, title: ex.title, status: r.status, outputOk, missing, starterPasses, msg: r.message || '', output: r.output.join('\\n') });
  }
  return out;
});
for (const r of practiceResults) {
  check(r.status === 'ok' && r.outputOk && !r.missing.length && !r.starterPasses,
    `Practice ${r.id} "${r.title}"`, `status=${r.status} ${r.msg} output=${r.output} missing=${r.missing} starterPasses=${r.starterPasses}`);
}

// ---------- Wrong code gives friendly help ----------
console.log('\nFriendly errors:');
const neg = await page.evaluate(async () => {
  const L = (id) => GameData.LEVELS.find((l) => l.id === id);
  const run = (code, id = 2) => BlockSnake.runner.run({ mode: 'level', code, maps: L(id).maps, options: {} }, 20000);
  const res = {};
  let m = await run('mve_right()');
  res.typo = m.runs[0].error;
  m = await run('for i in range(3)\n    move_right()');
  res.colon = m.runs[0].error;
  m = await run('for i in range(3):\nmove_right()');
  res.indent = m.runs[0].error;
  m = await run('move_right(5)');
  res.crash = m.runs[0].result.crash;
  res.crashLine = m.runs[0].crashLine;
  m = await run('while True:\n    pass');
  res.forever = m.runs[0].error;
  m = await run('while True:\n    move_right()\n    move_left()');
  res.backwards = m.runs[0].result.crash;
  m = await run('while can_move("right"):\n    move_right()\n    move_left()', 1);
  res.tail = m.runs[0].result.crash;
  m = await run('print("hi" + 5)');
  res.type = m.runs[0].error;
  m = await BlockSnake.runner.run({ mode: 'practice', code: 'move_right()' });
  res.nosnake = m.practice;
  m = await BlockSnake.runner.run({ mode: 'practice', code: 'x = input()' });
  res.input = m.practice;
  // A loop that hides from the line counter: the worker must be killed and restarted.
  m = await BlockSnake.runner.run({ mode: 'practice', code: 'while True:\n    try:\n        while True:\n            pass\n    except BaseException:\n        pass' }, 4000);
  res.killed = !!m.timedOut;
  m = await BlockSnake.runner.run({ mode: 'practice', code: 'print(6 * 7)' }, 60000);
  res.afterRestart = m.practice && m.practice.output.join('');
  return res;
});
check(neg.typo && /move_right/.test(neg.typo.message), 'Typo suggests move_right', JSON.stringify(neg.typo));
check(neg.colon && /colon/.test(neg.colon.message) && neg.colon.line === 1, 'Missing colon is explained', JSON.stringify(neg.colon));
check(neg.indent && /Spaces/.test(neg.indent.title), 'Missing indent is explained', JSON.stringify(neg.indent));
check(neg.crash && neg.crash.kind === 'block' && neg.crashLine === 1, 'Walking into a wall is a crash on line 1', JSON.stringify(neg.crash) + ' line ' + neg.crashLine);
check(neg.forever && /never stops/.test(neg.forever.title), 'while True is caught', JSON.stringify(neg.forever));
check(neg.backwards && neg.backwards.kind === 'self', 'Going backwards bites the tail', JSON.stringify(neg.backwards));
check(neg.tail && neg.tail.kind === 'self', 'Tail crash', JSON.stringify(neg.tail));
check(neg.type && /text and numbers/.test(neg.type.message), 'Text + number is explained', JSON.stringify(neg.type));
check(neg.nosnake && /practice/.test(neg.nosnake.message), 'Snake commands in practice explained', JSON.stringify(neg.nosnake));
check(neg.input && /input/.test(neg.input.message), 'input() is explained', JSON.stringify(neg.input));
check(neg.killed, 'Hidden infinite loop is stopped by the watchdog');
check(neg.afterRestart === '42', 'Python works again after a restart', neg.afterRestart);

// ---------- Real UI: play level 1 ----------
console.log('\nUI:');
await page.goto(BASE + '/index.html#/map');
await page.waitForSelector('.world-card');
await page.screenshot({ path: path.join(OUT, '02-map.png'), fullPage: false });
await page.goto(BASE + '/index.html#/level/1');
await page.waitForSelector('.CodeMirror');
await page.waitForFunction(() => document.querySelector('.py-status.ready'), null, { timeout: 180000 });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, '03-level1-start.png') });
await page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.setValue('move_right()\nmove_right()\nmove_right()\n'));
await page.click('#btn-run');
await page.waitForSelector('#modal:not([hidden])', { timeout: 30000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT, '04-level1-win.png') });
const title = await page.textContent('#modal-title');
check(/PERFECT/.test(title), 'Level 1 win dialog shows 3 stars', title);
const saved = await page.evaluate(() => BlockSnake.store.stars[1]);
check(saved === 3, 'Stars are saved', String(saved));

// Crash in the UI shows a message
await page.goto(BASE + '/index.html#/level/2');
await page.waitForSelector('.CodeMirror');
await page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.setValue('move_right(5)\n'));
await page.click('#btn-run');
await page.waitForSelector('#message:not([hidden])', { timeout: 30000 });
const crashMsg = await page.textContent('#message');
check(/wall/.test(crashMsg), 'Crash message shown in UI', crashMsg);
await page.screenshot({ path: path.join(OUT, '05-level2-crash.png') });

// A few more good-looking screenshots
for (const [id, name] of [[9, '06-desert'], [15, '07-island'], [18, '08-woods'], [23, '09-lava']]) {
  await page.evaluate(() => { BlockSnake.store.unlockAll = true; });
  await page.goto(BASE + '/index.html#/level/' + id);
  await page.waitForSelector('.CodeMirror');
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
}

await page.goto(BASE + '/index.html#/practice/f2');
await page.waitForSelector('#practice-task h3');
await page.evaluate(() => document.querySelectorAll('.CodeMirror')[1].CodeMirror.setValue('def greet(name):\n    print("Hello, " + name + "!")\n\ngreet("Ana")\ngreet("Leo")\n'));
await page.click('#practice-run');
await page.waitForSelector('#practice-message.good', { timeout: 30000 });
check(true, 'Practice exercise can be solved in the UI');
await page.screenshot({ path: path.join(OUT, '10-practice.png') });

// Phone size
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await routeCdn(phone);
await phone.addInitScript(() => localStorage.setItem('blocksnake.v1', JSON.stringify({ unlockAll: true })));
const p2 = await phone.newPage();
await p2.goto(BASE + '/index.html#/level/5');
await p2.waitForSelector('.CodeMirror');
await p2.waitForTimeout(1200);
const overflow = await p2.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
check(!overflow, 'No sideways scrolling on a phone');
await p2.screenshot({ path: path.join(OUT, '11-phone-level.png') });
await p2.goto(BASE + '/index.html#/');
await p2.waitForTimeout(1500);
await p2.screenshot({ path: path.join(OUT, '12-phone-home.png') });

check(pageErrors.length === 0, 'No JavaScript errors on the page', pageErrors.join('\n       '));

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed!');
process.exit(failures ? 1 : 0);

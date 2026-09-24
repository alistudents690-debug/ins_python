// Builds a self-contained copy of BlockSnake in dist/:
//   dist/blocksnake.html   the page with all CSS and JS inlined
//   dist/pyodide/...       a local copy of Python (from node_modules/pyodide),
//                          with the standard library packed into a script
// Useful for hosts that can't load Python from the jsDelivr CDN.
//
//   npm install && node tools/build-single.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let html = read('index.html');

// The host page adds <!doctype>, <html>, <head> and <body> itself.
html = html
  .replace(/<!DOCTYPE html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/<\/html>\s*/i, '')
  .replace(/<head>\s*/i, '')
  .replace(/<\/head>\s*/i, '')
  .replace(/<body>\s*/i, '')
  .replace(/<\/body>\s*/i, '')
  .replace(/\s*<meta charset="utf-8">/i, '')
  .replace(/\s*<meta name="viewport"[^>]*>/i, '');

const inlineCss = (css) => '<style>\n' + css + '\n</style>';
const inlineJs = (js) => {
  if (/<\/script/i.test(js)) throw new Error('script contains </script');
  return '<script>\n' + js + '\n</script>';
};

html = html.replace(
  /<link rel="stylesheet" href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/codemirror\/[^"]+codemirror\.min\.css">/,
  () => inlineCss(read('node_modules/codemirror/lib/codemirror.css'))
);
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => inlineCss(read('css/style.css')));
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, src) => {
  let out = inlineJs(read(src));
  if (src === 'js/runner.js') {
    out = "<script>window.BLOCKSNAKE_PYODIDE_URL = 'pyodide/'; window.BLOCKSNAKE_STDLIB_JS = 'pyodide/python_stdlib.js';</script>\n  " + out;
  }
  return out;
});

// Put <title> first.
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
html = title + '\n' + html.replace(title, '').trimStart();

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'pyodide'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'blocksnake.html'), html);
for (const f of ['pyodide.js', 'pyodide.asm.js', 'pyodide.asm.wasm', 'pyodide-lock.json']) {
  fs.copyFileSync(path.join(ROOT, 'node_modules/pyodide', f), path.join(OUT, 'pyodide', f));
}
// The standard library as base64 in a script (some hosts don't serve .zip files).
const zip = fs.readFileSync(path.join(ROOT, 'node_modules/pyodide/python_stdlib.zip'));
fs.writeFileSync(path.join(OUT, 'pyodide', 'python_stdlib.js'), 'self.BLOCKSNAKE_STDLIB_B64 = "' + zip.toString('base64') + '";\n');
console.log('Built dist/blocksnake.html (' + Math.round(html.length / 1024) + ' KB) and dist/pyodide/');

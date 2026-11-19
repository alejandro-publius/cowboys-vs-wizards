// Usage: node prototypes/playtest-lab/build.mjs <abs dragon-fire.html> <abs wraith-drift.html>
// Copies the launcher and the two offline builds into dist/playtest-lab/.
import {copyFileSync, existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {isAbsolute, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = resolve(here, '..', '..', 'dist', 'playtest-lab');
const launcher = join(here, 'index.html');

// Attribute values that point at another file or the network break a moved page.
const EXTERNAL_ATTR = /\b(?:src|href|poster|data)\s*=\s*["']?\s*(?!data:|blob:|#|about:|mailto:|javascript:)([^"'\s>]+)/gi;
const EXTERNAL_CSS = /url\(\s*["']?\s*(?!data:|blob:|#)([^"')\s]+)/gi;

function fail(message) {
  console.error('playtest-lab build failed: ' + message);
  process.exit(1);
}

function validate(label, path) {
  if (!path) fail(label + ': missing path argument');
  if (!isAbsolute(path)) fail(label + ': path must be absolute: ' + path);
  if (!/\.html?$/i.test(path)) fail(label + ': expected an .html file: ' + path);
  if (!existsSync(path)) fail(label + ': file not found: ' + path);
  const info = statSync(path);
  if (!info.isFile()) fail(label + ': not a regular file: ' + path);
  if (info.size === 0) fail(label + ': file is empty: ' + path);
  const text = readFileSync(path, 'utf8');
  if (!/<html[\s>]/i.test(text)) fail(label + ': no <html> element found: ' + path);
  // Bundled script bodies contain strings that look like attributes; scan markup and CSS only.
  const markup = text.replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, '$1$2');
  const refs = new Set();
  for (const m of markup.matchAll(EXTERNAL_ATTR)) refs.add(m[1]);
  for (const m of markup.matchAll(EXTERNAL_CSS)) refs.add(m[1]);
  if (refs.size) {
    fail(label + ': page is not self-contained, it references: ' + [...refs].slice(0, 5).join(', '));
  }
}

const [dragonPath, wraithPath, ...extra] = process.argv.slice(2);
if (extra.length) fail('expected exactly two arguments, got ' + (2 + extra.length));
validate('Dragon Fire', dragonPath);
validate('Wraith Drift', wraithPath);
if (resolve(dragonPath) === resolve(wraithPath)) fail('both arguments point to the same file');
if (!existsSync(launcher)) fail('launcher missing: ' + launcher);

mkdirSync(outDir, {recursive: true});
copyFileSync(launcher, join(outDir, 'index.html'));
copyFileSync(dragonPath, join(outDir, 'dragon-fire.html'));
copyFileSync(wraithPath, join(outDir, 'wraith-drift.html'));

// The index links to ./dragon-fire.html and ./wraith-drift.html; confirm both targets exist.
const index = readFileSync(join(outDir, 'index.html'), 'utf8');
for (const name of ['dragon-fire.html', 'wraith-drift.html']) {
  if (!index.includes('href="./' + name + '"')) fail('index.html does not link to ./' + name);
  if (!existsSync(join(outDir, name))) fail('missing output: ' + name);
}
console.log('playtest-lab written to ' + outDir);

// Usage: node prototypes/playtest-lab/build.mjs <abs dragon-fire.html> <abs wraith-drift.html> <abs first-duel.html>
// Copies the launcher and the three offline builds into dist/playtest-lab/.
import {copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
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

const [dragonPath, wraithPath, duelPath, ...extra] = process.argv.slice(2);
if (extra.length) fail('expected exactly three arguments, got ' + (3 + extra.length));
validate('Dragon Fire', dragonPath);
validate('Wraith Drift', wraithPath);
validate('First duel', duelPath);
const resolved = [dragonPath, wraithPath, duelPath].map((p) => resolve(p));
if (new Set(resolved).size !== resolved.length) fail('two arguments point to the same file');
if (!existsSync(launcher)) fail('launcher missing: ' + launcher);

mkdirSync(outDir, {recursive: true});
copyFileSync(launcher, join(outDir, 'index.html'));
copyFileSync(dragonPath, join(outDir, 'dragon-fire.html'));
copyFileSync(wraithPath, join(outDir, 'wraith-drift.html'));
copyFileSync(duelPath, join(outDir, 'first-duel.html'));

const readme = [
  'Orb Duel Playtest Lab',
  '',
  'Everything here runs locally. Nothing is sent anywhere.',
  '',
  'Launch',
  '1. Open a fresh browser profile or a new private/incognito window for each participant.',
  '2. In that window, open index.html from this folder (double-click it, or drag it into the window).',
  '3. Use the launch links. The first duel has a guided link (bare address) and a standard link (?seed=690).',
  '',
  'Observe',
  '- Optional: press Start in the Observer timer when the participant begins, then use the Mark buttons.',
  '  Marks fill the two time fields. Each mark works once until you press Reset timer. You can type times instead.',
  '',
  'Save and exchange',
  '1. Fill in the Session record, then press "Download session record (.json)".',
  '   Feedback has its own "Download observation (.json)" button.',
  '2. The files land in your browser downloads folder.',
  '3. Send or hand over those .json files to the organizer. Each is plain text and can be opened in any editor.',
  ''
].join('\n');
writeFileSync(join(outDir, 'README.txt'), readme);

// The index links to each bundled page; confirm every target exists. The first duel is linked twice (bare and ?seed=690).
const index = readFileSync(join(outDir, 'index.html'), 'utf8');
for (const name of ['dragon-fire.html', 'wraith-drift.html', 'first-duel.html']) {
  if (!index.includes('href="./' + name + '"')) fail('index.html does not link to ./' + name);
  if (!existsSync(join(outDir, name))) fail('missing output: ' + name);
}
if (!index.includes('href="./first-duel.html?seed=690"')) fail('index.html does not link to ./first-duel.html?seed=690');
console.log('playtest-lab written to ' + outDir);

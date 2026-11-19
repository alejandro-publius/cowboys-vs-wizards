// Usage: node prototypes/playtest-lab/build.mjs <abs first-duel.html>
// Copies the launcher, report and the first-duel candidate build into dist/playtest-lab/.
import {copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {isAbsolute, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = resolve(here, '..', '..', 'dist', 'playtest-lab');
const launcher = join(here, 'index.html');
const report = join(here, '..', 'playtest-report', 'index.html');

// Attribute values that point at another file or the network break a moved page.
const EXTERNAL_ATTR = /\b(?:src|href|poster|data)\s*=\s*["']?\s*(?!data:|blob:|#|\?|about:|mailto:|javascript:)([^"'\s>]+)/gi;
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

const [duelPath, ...extra] = process.argv.slice(2);
if (extra.length) fail('expected one argument, got ' + (1 + extra.length));
validate('First duel', duelPath);
validate('Playtest report', report);
if (!existsSync(launcher)) fail('launcher missing: ' + launcher);

mkdirSync(outDir, {recursive: true});
copyFileSync(launcher, join(outDir, 'index.html'));
copyFileSync(duelPath, join(outDir, 'first-duel.html'));
copyFileSync(report, join(outDir, 'report.html'));

const readme = [
  'Orb Duel First Duel Pilot',
  '',
  'Everything here runs locally. Nothing is sent anywhere.',
  '',
  'Pilot size',
  '- The release line names three players overall. That is a pilot.',
  '- The original A/B decision brief requires at least three per arm, so these sessions cannot decide between the links.',
  '',
  'Launch',
  '1. Open a fresh private/incognito window for each participant. Never reuse a participant.',
  '2. In that window, open index.html from this folder (double-click it, or drag it into the window).',
  '3. Use one launch link. Both play seed 690 in the same bundled build:',
  '   guided (bare address, first-duel.html) or standard (first-duel.html?seed=690).',
  '',
  'Session script',
  '- Say: "This is a card game. Play it for three minutes. I can\'t answer questions while you play. Please say what you\'re thinking out loud."',
  '- Give no task, goal or prompt. Stop at 3:00 whatever is on screen.',
  '- Afterwards ask: "What are you trying to do in this game?" and "What happened in the last clash you saw, and why?" Write answers word for word.',
  '',
  'Four observations',
  '1. Time to first summon, in seconds.',
  '2. Time to first End turn, in seconds, and whether it came before any summon.',
  '3. Round reached, or the result, at 3:00.',
  '4. Stated goal, word for word.',
  '',
  'Observer timer (optional)',
  '- Press Start when the participant begins, then use the Mark buttons.',
  '  Marks fill the two time fields. Each mark works once until you press Reset timer. You can type times instead.',
  '',
  'Save and exchange',
  '1. Fill in the Session record, then press "Download session record (.json)".',
  '2. The file lands in your browser downloads folder.',
  '3. Share the session JSON with the organizer. In index.html, choose Compare exported sessions and select the files.',
  ''
].join('\n');
writeFileSync(join(outDir, 'README.txt'), readme);

// The index links to each bundled page; confirm every target exists. The first duel is linked twice (bare and ?seed=690).
const index = readFileSync(join(outDir, 'index.html'), 'utf8');
for (const name of ['first-duel.html', 'report.html']) {
  if (!index.includes('href="./' + name + '"')) fail('index.html does not link to ./' + name);
  if (!existsSync(join(outDir, name))) fail('missing output: ' + name);
}
if (!index.includes('href="./first-duel.html?seed=690"')) fail('index.html does not link to ./first-duel.html?seed=690');
console.log('playtest-lab written to ' + outDir);

import { build } from 'esbuild';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const read = (name, encoding) => readFile(new URL(name, root), encoding);
const modelFiles = (await readdir(new URL('assets/models/', root))).filter(name => name.endsWith('.glb'));
const models = Object.fromEntries(await Promise.all(modelFiles.map(async name => [
  name.slice(0, -4), (await read(`assets/models/${name}`)).toString('base64'),
])));
const art = Object.fromEntries(await Promise.all(['card-back', 'board', 'billy', 'wizard'].map(async name => [
  name, `data:image/webp;base64,${(await read(`playtest/${name}.webp`)).toString('base64')}`,
])));
const css = (await read('playtest/style.css', 'utf8')).replace(/@@ART:([a-z-]+)@@/g, (_, name) => art[name]);
const bundle = await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: ['playtest/game.js'],
  bundle: true, write: false, platform: 'browser', target: 'es2022',
  minify: true, legalComments: 'inline',
});
const code = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const licenses = await Promise.all([
  read('node_modules/three/LICENSE', 'utf8'),
  read('node_modules/@dimforge/rapier3d-compat/LICENSE', 'utf8'),
]);
const html = (await read('playtest/index.html', 'utf8'))
  .replace('@@STYLE@@', () => css)
  .replace('@@MODELS@@', () => JSON.stringify(models))
  .replace('@@CODE@@', () => code)
  .replace('@@LICENSES@@', () => licenses.join('\n\n'));
const output = new URL('dist/cowboys-vs-wizards-playtest.html', root);
await mkdir(new URL('dist/', root), {recursive: true});
await writeFile(output, html);
console.log(`Built ${fileURLToPath(output)} (${(Buffer.byteLength(html) / 2 ** 20).toFixed(1)} MiB)`);

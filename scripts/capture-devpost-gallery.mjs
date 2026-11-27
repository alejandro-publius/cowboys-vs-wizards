// Captures and verifies 5 Devpost 3:2 (1200x800) gallery PNG screenshots from staged `dist/web/` (DGR-1, DGR-2).
//
//   node scripts/capture-devpost-gallery.mjs --capture [--dir dist/web] [--out docs/evidence/devpost-gallery]
//   node scripts/capture-devpost-gallery.mjs --verify  [--out docs/evidence/devpost-gallery]
import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync, readFileSync} from "node:fs";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";

export const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
export const DEFAULT_GALLERY_DIR = "docs/evidence/devpost-gallery";
export const WIDTH = 1200;
export const HEIGHT = 800;
export const MIN_BYTES = 20_000;
const BASE_PATH = "/cowboys-vs-wizards/";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const SHOTS = Object.freeze([
  {
    id: "01-title-and-challenge",
    file: "01-title-and-challenge.png",
    rel: "",
    waitExpr: "!!document.querySelector('#title-screen') && document.readyState === 'complete'",
    settleMs: 900,
    caption: "Illustrated Showdown title screen opening directly to Ride or Fight?, Night Shift Saloon, and Camp.",
  },
  {
    id: "02-saloon-billy-courtroom",
    file: "02-saloon-billy-courtroom.png",
    rel: "?saloon=review",
    waitExpr: "!!document.querySelector('.saloon-billy-table button[data-shot]')",
    settleMs: 900,
    caption: "Night Shift Saloon courtroom: fire Billy at 2 attack vs Kiro's proposed 1 attack and inspect the 100,000-duel gate.",
  },
  {
    id: "03-outrider-3d-bone-fence",
    file: "03-outrider-3d-bone-fence.png",
    rel: "?outrider=case-e",
    waitExpr: "!!document.querySelector('#sd-board [data-own]')",
    evalBeforeShot: "(() => { const b = document.querySelector('#sd-board [data-own=\"0\"] button, #sd-board [data-own=\"0\"]'); if (b) b.click(); return true; })()",
    settleMs: 900,
    caption: "3D Bone Fence Outrider turn: compare striking the Skeleton vs riding past to hit the Wizard Base for 1 orb.",
  },
  {
    id: "04-even-fight-tactical-duel",
    file: "04-even-fight-tactical-duel.png",
    rel: "?even-fight=1",
    waitExpr: "!!document.querySelector('#sd-board')",
    settleMs: 900,
    caption: "Showdown Even Fight board: tactical 3-slot lanes, glowing life orbs, hand cards, and inspectable graveyards.",
  },
  {
    id: "05-boot-hill-poker-frontier-kit",
    file: "05-boot-hill-poker-frontier-kit.png",
    rel: "poker/",
    waitExpr: "document.readyState === 'complete' && document.body.textContent.trim().length > 40",
    settleMs: 600,
    caption: "Boot Hill Poker (/poker/): live second game sharing packages/frontier-kit seeded RNG and paired-cohort audit tools.",
  },
]);

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function readPngDimensions(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24 || !buf.subarray(0, 8).equals(PNG_MAGIC)) {
    return null;
  }
  if (buf.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return {width: buf.readUInt32BE(16), height: buf.readUInt32BE(20)};
}

export function verifyGalleryManifest(galleryDir = DEFAULT_GALLERY_DIR, root = ROOT) {
  const absDir = path.resolve(root, galleryDir);
  const manifestPath = path.join(absDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    return {ok: false, problems: [`Missing manifest: ${manifestPath}`], images: []};
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    return {ok: false, problems: [`Invalid JSON in manifest.json: ${err.message}`], images: []};
  }
  const problems = [];
  if (manifest.schema !== "cvw-devpost-gallery/1") problems.push("manifest.schema must be cvw-devpost-gallery/1");
  if (!/^[0-9a-f]{40}$/.test(String(manifest.commit ?? ""))) problems.push("manifest.commit must be a 40-hex SHA");
  if (!Array.isArray(manifest.images) || manifest.images.length !== SHOTS.length) {
    problems.push(`manifest.images must list ${SHOTS.length} shots`);
    return {ok: false, problems, images: []};
  }
  const checked = [];
  for (const expected of SHOTS) {
    const entry = manifest.images.find((img) => img.id === expected.id);
    if (!entry) {
      problems.push(`Missing manifest entry for ${expected.id}`);
      continue;
    }
    const imgPath = path.join(absDir, expected.file);
    if (!existsSync(imgPath)) {
      problems.push(`Missing PNG file: ${expected.file}`);
      continue;
    }
    const bytes = readFileSync(imgPath);
    const dims = readPngDimensions(bytes);
    if (!dims) {
      problems.push(`${expected.file} is not a valid PNG`);
      continue;
    }
    if (dims.width !== WIDTH || dims.height !== HEIGHT) {
      problems.push(`${expected.file} dimensions ${dims.width}x${dims.height} != ${WIDTH}x${HEIGHT}`);
    }
    if (bytes.length < MIN_BYTES) {
      problems.push(`${expected.file} size ${bytes.length} bytes < ${MIN_BYTES}`);
    }
    const actualSha = sha256(bytes);
    if (entry.sha256 !== actualSha) {
      problems.push(`${expected.file} sha256 mismatch (${entry.sha256} != ${actualSha})`);
    }
    checked.push({id: expected.id, file: expected.file, width: dims.width, height: dims.height, bytes: bytes.length, sha256: actualSha});
  }
  return {ok: problems.length === 0, problems, images: checked, commit: manifest.commit};
}

function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const waiting = new Map(), listeners = new Set();
    let next = 0;
    ws.addEventListener("message", ({data}) => {
      const msg = JSON.parse(data);
      if (msg.id === undefined) { for (const fn of listeners) fn(msg); return; }
      const pending = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) pending?.reject(new Error(`${pending.method}: ${msg.error.message}`));
      else pending?.resolve(msg.result);
    });
    ws.addEventListener("error", () => reject(new Error(`CDP WebSocket error on ${url}`)));
    ws.addEventListener("open", () => resolve({
      send(method, params = {}, sessionId) {
        const id = ++next;
        ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
        return new Promise((ok, fail) => waiting.set(id, {resolve: ok, reject: fail, method}));
      },
      on: (fn) => listeners.add(fn),
      close: () => ws.close(),
    }));
  });
}

async function captureGallery({webDir, outDir}) {
  const absWeb = path.resolve(ROOT, webDir);
  const absOut = path.resolve(ROOT, outDir);
  const buildJson = JSON.parse(await readFile(path.join(absWeb, "build.json"), "utf8"));
  await mkdir(absOut, {recursive: true});

  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".webp": "image/webp",
    ".glb": "model/gltf-binary",
  };

  const server = createServer(async (req, res) => {
    const u = new URL(req.url, "http://localhost");
    if (u.pathname === "/favicon.ico") { res.statusCode = 204; return res.end(); }
    let rel = decodeURIComponent(u.pathname);
    if (!rel.startsWith(BASE_PATH)) { res.statusCode = 404; return res.end("outside site"); }
    rel = rel.slice(BASE_PATH.length);
    const file = path.resolve(absWeb, rel.endsWith("/") || rel === "" ? rel + "index.html" : rel);
    if (!file.startsWith(absWeb + path.sep)) { res.statusCode = 403; return res.end(); }
    try {
      const body = await readFile(file);
      res.setHeader("content-type", mime[path.extname(file)] ?? "application/octet-stream");
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end("not found");
    }
  });

  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const site = `http://127.0.0.1:${server.address().port}${BASE_PATH}`;
  const profile = await mkdtemp("/tmp/cvw-gallery-chrome-");
  const child = spawn(CHROME, [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--mute-audio",
    "--hide-scrollbars",
    "about:blank",
  ], {stdio: ["ignore", "ignore", "pipe"]});

  let wsEndpoint = null;
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(chunk);
    if (m) wsEndpoint = m[1];
  });

  try {
    for (let i = 0; i < 60 && !wsEndpoint; i += 1) await sleep(100);
    if (!wsEndpoint) throw new Error("Chrome DevTools endpoint did not start.");
    const cdp = await connectCdp(wsEndpoint);
    const {targetId} = await cdp.send("Target.createTarget", {url: "about:blank"});
    const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true});
    const pageErrors = [];
    cdp.on((msg) => {
      if (msg.sessionId !== sessionId) return;
      if (msg.method === "Runtime.exceptionThrown") {
        pageErrors.push(msg.params?.exceptionDetails?.text ?? "Runtime exception");
      }
    });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
    }, sessionId);

    const images = [];
    for (const shot of SHOTS) {
      pageErrors.length = 0;
      const targetUrl = site + shot.rel;
      await cdp.send("Page.navigate", {url: targetUrl}, sessionId);
      let ready = false;
      for (let i = 0; i < 60; i += 1) {
        const evalRes = await cdp.send("Runtime.evaluate", {expression: shot.waitExpr, returnByValue: true}, sessionId);
        if (evalRes.result?.value === true) { ready = true; break; }
        await sleep(150);
      }
      if (!ready) throw new Error(`Timed out waiting for ${shot.id} (${shot.waitExpr})`);
      if (shot.evalBeforeShot) {
        await cdp.send("Runtime.evaluate", {expression: shot.evalBeforeShot, returnByValue: true}, sessionId);
      }
      await sleep(shot.settleMs);
      if (pageErrors.length) {
        throw new Error(`Page errors on ${shot.id}: ${pageErrors.join("; ")}`);
      }
      const {data} = await cdp.send("Page.captureScreenshot", {
        format: "png",
        clip: {x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1},
      }, sessionId);
      const buf = Buffer.from(data, "base64");
      const outPath = path.join(absOut, shot.file);
      await writeFile(outPath, buf);
      images.push({
        id: shot.id,
        file: shot.file,
        route: BASE_PATH + shot.rel,
        width: WIDTH,
        height: HEIGHT,
        bytes: buf.length,
        sha256: sha256(buf),
        caption: shot.caption,
      });
    }

    const manifest = {
      schema: "cvw-devpost-gallery/1",
      commit: buildJson.commit,
      indexHtmlSha256: buildJson.sha256 ?? null,
      aspectRatio: "3:2",
      width: WIDTH,
      height: HEIGHT,
      images,
    };
    await writeFile(path.join(absOut, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    cdp.close();
    return manifest;
  } finally {
    child.kill("SIGTERM");
    await Promise.race([new Promise((r) => child.once("exit", r)), sleep(1500)]);
    server.close();
    await rm(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 100}).catch(() => {});
  }
}

async function main(argv) {
  const mode = argv.includes("--capture") ? "capture" : argv.includes("--verify") ? "verify" : null;
  const opt = (flag, fallback) => { const idx = argv.indexOf(flag); return idx < 0 ? fallback : argv[idx + 1]; };
  const webDir = opt("--dir", "dist/web");
  const outDir = opt("--out", DEFAULT_GALLERY_DIR);
  if (mode === "capture") {
    const manifest = await captureGallery({webDir, outDir});
    const verified = verifyGalleryManifest(outDir, ROOT);
    if (!verified.ok) throw new Error(verified.problems.join("; "));
    console.log(JSON.stringify({captured: manifest.images.length, commit: manifest.commit, outDir}));
    return 0;
  }
  if (mode === "verify") {
    const verified = verifyGalleryManifest(outDir, ROOT);
    console.log(JSON.stringify(verified));
    return verified.ok ? 0 : 1;
  }
  console.error("Usage: node scripts/capture-devpost-gallery.mjs <--capture|--verify> [--dir dist/web] [--out docs/evidence/devpost-gallery]");
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

// Static server for dist/web mounted under /cowboys-vs-wizards/ (GitHub Pages project path), explicit content types, no compression.
import {createServer} from "node:http";
import {readFile, stat} from "node:fs/promises";
import path from "node:path";
const [dir, port] = [path.resolve(process.argv[2]), Number(process.argv[3])];
const prefix = "/cowboys-vs-wizards/";
const types = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".glb": "model/gltf-binary"};
createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (!url.pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
  let p = path.join(dir, decodeURIComponent(url.pathname.slice(prefix.length)));
  if (!p.startsWith(dir)) { res.writeHead(403).end(); return; }
  try {
    const s = await stat(p);
    if (s.isDirectory()) {
      if (!url.pathname.endsWith("/")) { res.writeHead(301, {Location: url.pathname + "/" + url.search}).end(); return; }
      p = path.join(p, "index.html");
    }
    const body = await readFile(p);
    res.writeHead(200, {"Content-Type": types[path.extname(p)] ?? "application/octet-stream", "Content-Length": body.length, "Cache-Control": "no-store"}).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(port, "127.0.0.1", () => console.log(`serving ${dir} at http://127.0.0.1:${port}${prefix}`));

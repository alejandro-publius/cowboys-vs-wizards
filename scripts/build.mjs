import {build} from "esbuild";
import {mkdir,readFile,readdir,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";

const rootUrl = new URL("../", import.meta.url);
const root = fileURLToPath(rootUrl);
const path = name => new URL(name, rootUrl);
const utf8 = name => readFile(path(name),"utf8");
const base64 = async name => (await readFile(path(name))).toString("base64");
const files = (await readdir(path("assets/models/"))).filter(file => file.endsWith(".glb"));
const assetMap = Object.fromEntries(await Promise.all(files.map(async file=>[file.slice(0,-4),await base64("assets/models/"+file)])));
const compiled=await build({absWorkingDir:root,entryPoints:["src/main.js"],bundle:true,write:false,
  platform:"browser",target:"es2022",minify:true,legalComments:"inline"});
const script=compiled.outputFiles[0].text.replace(/<\/script/gi,"<\\/script");
const notices=await Promise.all([utf8("node_modules/three/LICENSE"),utf8("node_modules/@dimforge/rapier3d-compat/LICENSE")]);
const html=(await utf8("src/ui/layout.html")).replace("@@ASSETS@@",JSON.stringify(assetMap))
  .replace("@@POSTER@@",await base64("assets/media/board.jpg"))
  .replace("@@VIDEO@@",await base64("assets/media/replay.mp4"))
  .replace("@@SCRIPT@@",()=>script)
  .replace("</body>",'<script type="text/plain" id="licenses">\n'+notices.join("\n")+'\n</script>\n</body>');
await mkdir(path("dist/"),{recursive:true});
await writeFile(path("dist/cowboys-vs-wizards-board-duel.html"),html);
console.log("Built dist/cowboys-vs-wizards-board-duel.html");

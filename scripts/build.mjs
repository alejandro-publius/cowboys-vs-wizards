import {build} from "esbuild";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {arenaModelNames,perimeterModelNames} from "../src/render/model-assets.js";

const rootUrl = new URL("../", import.meta.url);
const root = fileURLToPath(rootUrl);
const path = name => new URL(name, rootUrl);
const utf8 = name => readFile(path(name),"utf8");
const base64 = async name => (await readFile(path(name))).toString("base64");
const web = process.argv.includes("--web");
const outDir = web ? "dist/web/" : "dist/";
const files = [...arenaModelNames,...perimeterModelNames].sort().map(name => name+".glb");
// --web: copy a file next to index.html under a content-hashed name and return its relative URL.
if (web) await mkdir(path(outDir+"assets/"),{recursive:true});
const copyAsset = async name => {
  const bytes = await readFile(path(name)), dot = name.lastIndexOf("."), slash = name.lastIndexOf("/");
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0,12);
  const url = "assets/" + name.slice(slash+1,dot) + "." + hash + name.slice(dot);
  await writeFile(path(outDir+url),bytes);
  return url;
};
const assetMap = Object.fromEntries(await Promise.all(files.map(async file=>[file.slice(0,-4),web?{url:await copyAsset("assets/models/"+file)}:await base64("assets/models/"+file)])));
const compiled=await build({absWorkingDir:root,entryPoints:["src/main.js"],bundle:true,write:false,
  platform:"browser",target:"es2022",loader:{".webp":web?"file":"dataurl"},minify:true,legalComments:"inline",
  ...(web?{outdir:outDir,assetNames:"assets/[name].[hash]"}:{})});
const script=(web?compiled.outputFiles.find(file=>file.path.endsWith(".js")):compiled.outputFiles[0]).text.replace(/<\/script/gi,"<\\/script");
if(web)for(const file of compiled.outputFiles)if(!file.path.endsWith(".js")){
  const target=new URL(file.path.slice(root.length),rootUrl);
  await mkdir(new URL("./",target),{recursive:true});await writeFile(target,file.contents);
}
const notices=await Promise.all([utf8("node_modules/three/LICENSE"),utf8("node_modules/@dimforge/rapier3d-compat/LICENSE")]);
const artNames=["sheriff-card","billy-card","mounted-billy-card","deadeye-card","skeleton-card","wizard-card","dragon-card","singularity-card"];
const art=Object.fromEntries(await Promise.all(artNames.map(async name=>[name,web?await copyAsset("assets/cards/"+name+".webp"):"data:image/webp;base64,"+await base64("assets/cards/"+name+".webp")])));
let css=await utf8("src/ui/match.css");
if(web)css=css.replace("data:image/png;base64,@@CARDBACK@@",await copyAsset("assets/cards/card-back.png"));
const visualCss=css.replace(/@@ART:([a-z-]+)@@/g,(_,name)=>art[name]);
const html=(await utf8("src/ui/layout.html")).replace("@@MATCHSTYLE@@",()=>visualCss).replace("@@ASSETS@@",JSON.stringify(assetMap))
  .replace("@@POSTER@@",web?await copyAsset("assets/media/board.jpg"):"data:image/jpeg;base64,"+await base64("assets/media/board.jpg"))
  .replace("@@VIDEOURL@@",web?await copyAsset("assets/media/replay.mp4"):"")
  .replace("@@VIDEO@@",web?"":await base64("assets/media/replay.mp4"))
  .replace("@@CARDBACK@@",web?"":await base64("assets/cards/card-back.png"))
  .replace("@@SCRIPT@@",()=>script)
  .replace("</body>",'<script type="text/plain" id="licenses">\n'+notices.join("\n")+'\n</script>\n</body>');
await mkdir(path(outDir),{recursive:true});
const output=web?"dist/web/index.html":"dist/cowboys-vs-wizards-board-duel.html";
await writeFile(path(output),html);
console.log("Built "+output);

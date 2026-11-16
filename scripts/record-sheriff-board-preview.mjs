import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const WIDTH=1280,HEIGHT=720;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function launchChrome(extra) {
  const profile = await mkdtemp("/tmp/kiro-chrome-");
  // A first run (a second tab, none of the backgrounding flags) saw
  // document.visibilityState "hidden" partway through, with
  // requestAnimationFrame stopped and the match scheduler's clock with it.
  const child = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--mute-audio", "--hide-scrollbars",
    "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
    `--window-size=${WIDTH},${HEIGHT}`, ...extra, "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
  let stderr = "";
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no DevTools URL from Chrome in 30 s:\n${stderr}`)), 30000);
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      const found = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (found) {
        clearTimeout(timer);
        resolve(found[1]);
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited with ${code}:\n${stderr}`));
    });
  });
  return {
    url,
    stderr: () => stderr,
    async close() {
      if (child.exitCode === null) {
        const exited = new Promise((resolve) => child.once("exit", resolve));
        child.kill("SIGTERM");
        await Promise.race([exited, sleep(5000)]);
        if (child.exitCode === null) child.kill("SIGKILL");
      }
      // Chrome helpers can still be writing into the profile as they exit.
      await rm(profile, {recursive: true, force: true, maxRetries: 5});
    },
  };
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const waiting = new Map(), listeners = new Set();
    let next = 0;
    ws.addEventListener("message", ({data}) => {
      const message = JSON.parse(data);
      if (message.id === undefined) {
        for (const listener of listeners) listener(message);
        return;
      }
      const entry = waiting.get(message.id);
      waiting.delete(message.id);
      if (message.error) entry?.reject(new Error(`${entry.method}: ${message.error.message}`));
      else entry?.resolve(message.result);
    });
    ws.addEventListener("error", () => reject(new Error(`WebSocket error on ${url}`)));
    ws.addEventListener("open", () => resolve({
      send(method, params = {}, sessionId) {
        const id = ++next;
        ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
        return new Promise((ok, fail) => waiting.set(id, {resolve: ok, reject: fail, method}));
      },
      on: (listener) => listeners.add(listener),
      close: () => ws.close(),
    }));
  });
}

const outDir=path.join(root,'.artifacts/sheriff-board-preview');
await mkdir(outDir,{recursive:true});
const probe=process.argv.includes('--probe');
const chrome=await launchChrome(['--use-angle=swiftshader','--enable-unsafe-swiftshader']);
const cdp=await connect(chrome.url);
const errors=[];
try{
 const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});
 cdp.on(message=>{if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text+': '+(message.params.exceptionDetails.exception?.description||''));});
 await cdp.send('Page.enable',{},sessionId);
 await cdp.send('Runtime.enable',{},sessionId);
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
 await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__captureFrames=true;'},sessionId);
 await cdp.send('Page.navigate',{url:pathToFileURL(path.join(outDir,'index.html')).href},sessionId);
 async function evaluate(expression){
  const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
  if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
 }
 let ready=false;
 for(let i=0;i<120;i++){
  const state=await evaluate('({ready:!!window.__previewReady,error:window.__previewError||null})');
  if(state.error)throw new Error(state.error);
  if(state.ready){ready=true;break;}
  await sleep(250);
 }
 if(!ready)throw new Error('preview did not finish loading');
 const info=await evaluate('window.__approvedSheriffPreview.info');
 const samples=probe?[{t:0,view:'wide',name:'probe-wide.png'},{t:.24,view:'close',name:'probe-close.png'}]:
  ['wide','close'].flatMap(view=>Array.from({length:29},(_,i)=>({t:i/30,view,name:view+'/'+String(i).padStart(3,'0')+'.png'})));
 for(const name of ['wide','close'])await mkdir(path.join(outDir,name),{recursive:true});
 const evidence=[];
 for(let i=0;i<samples.length;i++){
  const {t,view,name}=samples[i];
  const state=await evaluate('window.__approvedSheriffPreview.frame('+t+','+JSON.stringify(view)+')');
  const {data}=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false},sessionId);
  await writeFile(path.join(outDir,name),Buffer.from(data,'base64'));
  evidence.push(state);
  if(i%30===0)console.log('Captured '+i+'/'+samples.length);
 }
 const report={info,frames:samples.length,errors,sourceCycles:{wide:1,close:1},minBootClearance:Math.min(...evidence.flatMap(e=>e.footCheck.map(f=>f.gap))),
  minSeatingOffset:Math.min(...evidence.map(e=>e.groundCorrection)),maxSeatingOffset:Math.max(...evidence.map(e=>e.groundCorrection)),
  scope:'Actual game board, perimeter, lighting and Three.js WebGL renderer. Isolated animation preview; no live-site or gameplay-trigger integration.'};
 await writeFile(path.join(outDir,probe?'probe.json':'recording.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
 if(errors.length)process.exitCode=1;
}finally{cdp.close();await chrome.close();}

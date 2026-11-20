// Real-browser title/menu checks using the same isolated Chrome protocol as browser-match-check.
// Target: the earlier illustrated build (lane duel, 3D board), built by `npm run build:art -- --web`
// and published at /3d/. The graybox build (`npm run build`) is Showdown only since #143 slice 3
// and has none of the lane screens this script drives.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtemp,rm,mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {createMatch} from "../src/game/state.js";
import {deckIds} from "../src/game/deck-builder.js";
const CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTH=1440,HEIGHT=810;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const url=process.argv[2];
if(!url)throw new Error("Pass the built page URL");
const out=path.resolve(process.argv[3]??".artifacts/title-menu/browser");
await mkdir(out,{recursive:true});
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


const chrome=await launchChrome([]),cdp=await connect(chrome.url);
const report={url,checks:[],errors:[],screenshots:[]};
const check=(name,detail)=>report.checks.push({name,passed:true,detail});
let send;
try{
 const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});
 const {sessionId}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
 send=(method,params)=>cdp.send(method,params,sessionId);
 cdp.on(({method,params,sessionId:id})=>{
  if(id!==sessionId)return;
  if(method==="Runtime.exceptionThrown")report.errors.push(params.exceptionDetails.exception?.description??params.exceptionDetails.text);
  if(method==="Runtime.consoleAPICalled"&&params.type==="error")report.errors.push(params.args.map(a=>a.value??a.description).join(" "));
 });
 await send("Page.enable");await send("Runtime.enable");
 await send("Emulation.setDeviceMetricsOverride",{width:WIDTH,height:HEIGHT,deviceScaleFactor:1,mobile:false});
 await send("Emulation.setFocusEmulationEnabled",{enabled:true});
 await send("Page.bringToFront");
 const evaluate=async expression=>{const r=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
 const wait=async(expression,ms=30000)=>{const stop=Date.now()+ms;while(Date.now()<stop){if(await evaluate(expression))return;await sleep(120);}throw Error("Timed out: "+expression);};
 const click=async selector=>{
  const p=await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n||n.disabled)throw Error('Unavailable: '+${JSON.stringify(selector)});n.scrollIntoView({block:'center'});const b=n.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2};})()`);
  await send("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",clickCount:1,...p});
  await send("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",clickCount:1,...p});
 };
 const key=async(key,code,keyCode)=>{await send("Input.dispatchKeyEvent",{type:"keyDown",key,code,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode,...(key==='Enter'?{text:"\r"}:{})});await send("Input.dispatchKeyEvent",{type:"keyUp",key,code,windowsVirtualKeyCode:keyCode});};
 const shot=async name=>{const {data}=await send("Page.captureScreenshot",{format:"png"});await writeFile(path.join(out,name+".png"),Buffer.from(data,"base64"));report.screenshots.push(name+".png");};
 const saved=()=>evaluate(`JSON.parse(localStorage.getItem('cvw-player-v1'))`);
 await send("Page.navigate",{url});
 await wait(`document.querySelector('.title-art')?.complete&&document.querySelector('.title-art').naturalWidth===1672&&document.querySelector('#title-screen')?.dataset.ready==='true'`);
 assert.equal(await evaluate(`document.getElementById('arena').hidden`),true);
 const hits=await evaluate(`Array.from(document.querySelectorAll('.menu-hotspot'),n=>{const b=n.getBoundingClientRect();return{id:n.id,hit:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===n,width:b.width,height:b.height}})`);
 assert(hits.every(x=>x.hit));check('Approved artwork and five native hit targets',hits);await shot('title-desktop');
 await evaluate(`document.getElementById('menu-play').focus()`);await key('ArrowDown','ArrowDown',40);assert.equal(await evaluate('document.activeElement.id'),'menu-how');await key('Enter','Enter',13);
 await wait(`document.getElementById('menu-page-title').textContent==='How to Play'`,3000);
 assert.equal(await evaluate(`document.getElementById('menu-page-title').textContent`),'How to Play');
 await key('Escape','Escape',27);assert.equal(await evaluate('document.activeElement.id'),'menu-how');check('Keyboard navigation, How to Play, Escape focus restoration');
 await click('#menu-settings');await click('#setting-reducedMotion');
 await evaluate(`const s=document.getElementById('setting-performance');s.value='low';s.dispatchEvent(new Event('change',{bubbles:true}));`);
 assert.equal((await saved()).settings.performance,'low');assert.equal(await evaluate(`document.documentElement.classList.contains('reduce-card-motion')`),true);await shot('settings');
 await click('#menu-back');await click('#menu-achievements');assert.equal(await evaluate(`document.querySelectorAll('[data-earned=true]').length`),0);check('Achievements start locked');
 await click('#menu-back');await click('#menu-deck');await click('button[aria-label="Remove Billy"]');
 assert.equal(await evaluate(`document.getElementById('save-deck').disabled`),true);
 await click('button[aria-label="Add Mounted Billy"]');await click('#save-deck');
 const expectedCounts={'cowboy-sheriff':6,'cowboy-billy':2,'cowboy-mounted-billy':2,'cowboy-deadeye':2};
 assert.deepEqual((await saved()).deck,expectedCounts);check('Deck counts validate and save',expectedCounts);
 const decoded=await evaluate(`Promise.all(Array.from(document.querySelectorAll('.deck-art'),async n=>{const bg=getComputedStyle(n).backgroundImage;const m=bg.match(/^url\\(["']?(.*?)["']?\\)$/);if(!m)throw Error('Missing card art '+bg);const image=new Image();image.src=m[1];await image.decode();return image.naturalWidth>0;}))`);
 assert(decoded.every(Boolean));check('All four deck card illustrations decode');await shot('deck-builder');
 await click('#menu-back');await click('#menu-achievements');assert.equal(await evaluate(`document.querySelector('[data-achievement="deck-builder"]').dataset.earned`),'true');check('Saving a deck unlocks only its achievement');
 await send('Page.reload');await wait(`document.querySelector('.title-art')?.complete&&document.getElementById('menu-play')`);
 assert.deepEqual((await saved()).deck,expectedCounts);assert.equal((await saved()).settings.reducedMotion,true);check('Settings and deck survive reload');
 await click('#menu-play');await wait(`!document.getElementById('arena').hidden&&document.getElementById('match').dataset.status==='accepting_input'`,180000);
 const hand=await evaluate(`Array.from(document.querySelectorAll('.match-hand [data-card-id]'),n=>n.dataset.cardId)`);
 assert.deepEqual(hand,createMatch(0,{cowboyDeck:deckIds(expectedCounts)}).sides.cowboy.hand);check('Play uses the saved deck in the actual seeded engine',hand);
 assert.equal(await evaluate(`document.querySelector('.selection-panel').hidden`),true);
 await click('.match-hand [data-card-id^="cowboy-sheriff"]');await click('.match-slot[data-side="cowboy"][data-slot="0"]');await click('[data-action="confirm"]');
 await wait(`document.getElementById('match').dataset.status==='accepting_input'`);assert.equal((await saved()).stats.summons,1);check('A real summon earns First Summon exactly once');
 await click('[data-action="end-phase"]');await wait(`['playing','cpu_turn'].includes(document.getElementById('match').dataset.status)`);
 await click('#home');
 const paused=await evaluate(`document.getElementById('match').innerText`);await sleep(1400);assert.equal(await evaluate(`document.getElementById('match').innerText`),paused);
 await click('#menu-achievements');assert.equal(await evaluate(`document.querySelector('[data-achievement="first-summon"]').dataset.earned`),'true');await shot('achievements');
 await click('#menu-back');await click('#menu-play');await wait(`document.getElementById('match').dataset.status==='accepting_input'`,60000);check('Mid-clash menu pause and resume preserve the match');
 await click('#home');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await sleep(200);const mobile=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,buttons:Array.from(document.querySelectorAll('.menu-hotspot'),b=>({id:b.id,h:b.getBoundingClientRect().height,w:b.getBoundingClientRect().width}))})`);
 assert.equal(mobile.overflow,false);assert(mobile.buttons.every(b=>b.h>=44&&b.w>=44));await shot('title-mobile');check('Portrait controls are readable, touch-sized, without horizontal overflow',mobile);
 const guidedUrl=new URL(url);
 guidedUrl.searchParams.set('seed','60');
 guidedUrl.searchParams.set('guide','0');
 await send('Page.navigate',{url:guidedUrl.href});
 await wait(`location.href===${JSON.stringify(guidedUrl.href)}&&document.getElementById('title-screen')?.dataset.ready==='true'`);
 await click('#menu-how');
 const guideButton=await evaluate(`(()=>{
   const b=document.getElementById('menu-guide'), r=b.getBoundingClientRect();
   return {height:r.height, fits:r.left>=0&&r.right<=innerWidth, describedBy:document.getElementById(b.getAttribute('aria-describedby'))?.textContent};
 })()`);
 assert(guideButton.height>=44&&guideButton.fits&&guideButton.describedBy.includes('starter-deck'));
 await key('Tab','Tab',9);assert.equal(await evaluate('document.activeElement.id'),'menu-guide');
 await key('Enter','Enter',13);
 await wait(`!document.getElementById('arena').hidden&&document.getElementById('match').dataset.status==='accepting_input'`,180000);
 const startingHand=await evaluate(`Array.from(document.querySelectorAll('.match-hand [data-card-id]'),n=>n.dataset.cardId)`);
 assert.deepEqual(startingHand,createMatch(0).sides.cowboy.hand);
 assert.match(await evaluate(`document.querySelector('.match-details code').textContent`),/\b0\b/);
 assert.equal(await evaluate(`document.querySelector('.selection-panel').hidden`),false);
 assert.match(await evaluate(`document.querySelector('.match-prompt').textContent`),/Glowing cards/);
 assert.deepEqual((await saved()).deck,expectedCounts);
 check('How to Play starts a playable starter duel with visible hints and preserves the saved deck',guideButton);
 await click('#home');await click('#menu-how');
 assert(await evaluate(`!document.getElementById('menu-guide')`));
 await key('Escape','Escape',27);await click('#menu-play');
 await wait(`!document.getElementById('arena').hidden&&document.getElementById('match').dataset.status==='accepting_input'`);
 assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.match-hand [data-card-id]'),n=>n.dataset.cardId)`),startingHand);
 assert.equal(await evaluate(`document.querySelector('.selection-panel').hidden`),false);
 check('Guided duel resumes with its opening state and cannot be replaced from How to Play');
 assert.deepEqual(report.errors,[]);
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
 await writeFile(path.join(out,'menu-run.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({checks:report.checks.length,errors:report.errors,error:report.error??null,out},null,2));
 cdp.close();await chrome.close();
}

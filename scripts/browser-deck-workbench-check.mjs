// Focused deck workbench readability check: node scripts/browser-deck-workbench-check.mjs URL OUTDIR
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtemp,rm,mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
const CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const url=process.argv[2],out=path.resolve(process.argv[3]??".artifacts/deck-workbench");
if(!url)throw new Error("Pass the built page URL");
await mkdir(out,{recursive:true});
const profile=await mkdtemp("/tmp/kiro-deck-");
const child=spawn(CHROME,["--headless=new","--remote-debugging-port=0",`--user-data-dir=${profile}`,"--no-first-run","--mute-audio","--hide-scrollbars","about:blank"],{stdio:["ignore","ignore","pipe"]});
let err="";const ws=await new Promise((res,rej)=>{const t=setTimeout(()=>rej(Error("no Chrome")),30000);child.stderr.on("data",d=>{err+=d;const m=err.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(t);res(m[1]);}});});
const sock=new WebSocket(ws);await new Promise(r=>sock.addEventListener("open",r));
let n=0;const wait=new Map();sock.addEventListener("message",({data})=>{const m=JSON.parse(data);if(m.id&&wait.has(m.id)){const w=wait.get(m.id);wait.delete(m.id);m.error?w.rej(Error(m.error.message)):w.res(m.result);}});
const send=(method,params={},sessionId)=>new Promise((res,rej)=>{const id=++n;wait.set(id,{res,rej});sock.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const report={url,viewports:[]};
try{
 const {targetId}=await send("Target.createTarget",{url:"about:blank"});
 const {sessionId}=await send("Target.attachToTarget",{targetId,flatten:true});
 const s=(m,p)=>send(m,p,sessionId);
 await s("Page.enable");await s("Runtime.enable");
 const ev=async e=>{const r=await s("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value;};
 const until=async e=>{const t=Date.now()+30000;while(Date.now()<t){if(await ev(e))return;await sleep(100);}throw Error("timeout "+e);};
 const click=async sel=>{const p=await ev(`(()=>{const n=document.querySelector(${JSON.stringify(sel)});if(!n||n.disabled)throw Error('Unavailable '+${JSON.stringify(sel)});n.scrollIntoView({block:'center'});const b=n.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()`);for(const type of["mousePressed","mouseReleased"])await s("Input.dispatchMouseEvent",{type,button:"left",clickCount:1,...p});};
 const key=async(k,c,v)=>{await s("Input.dispatchKeyEvent",{type:"keyDown",key:k,code:c,windowsVirtualKeyCode:v,...(k==="Enter"?{text:"\r"}:{})});await s("Input.dispatchKeyEvent",{type:"keyUp",key:k,code:c,windowsVirtualKeyCode:v});};
 const shot=async name=>{const {data}=await s("Page.captureScreenshot",{format:"png",captureBeyondViewport:true});await writeFile(path.join(out,name+".png"),Buffer.from(data,"base64"));};
 for(const [label,w,h,mobile,minCard] of [["desktop-1280x800",1280,800,false,180],["phone-390x844",390,844,true,150]]){
  await s("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile});
  await s("Page.navigate",{url});
  await until(`document.querySelector('#title-screen')?.dataset.ready==='true'`);
  await ev(`localStorage.clear()`);await s("Page.navigate",{url});
  await until(`document.querySelector('#title-screen')?.dataset.ready==='true'&&document.querySelector('.title-art')?.complete`);
  await click('#menu-deck');
  await until(`document.querySelectorAll('.deck-choice').length===4`);
  await sleep(500);
  const m=await ev(`(()=>{const r=n=>n.getBoundingClientRect();const cards=[...document.querySelectorAll('.deck-choice')].map(n=>Math.round(r(n).width));
   const art=[...document.querySelectorAll('.deck-art')].map(n=>Math.round(r(n).width));
   const small=[...document.querySelectorAll('.wb-panel *, .deck-choice *')].filter(n=>n.childElementCount===0&&n.textContent.trim()&&parseFloat(getComputedStyle(n).fontSize)<16).map(n=>n.textContent+':'+getComputedStyle(n).fontSize);
   const targets=[...document.querySelectorAll('.deck-row .step,#save-deck')].map(n=>[Math.round(r(n).width),Math.round(r(n).height)]);
   return{cards,art,small,targets,overflow:document.documentElement.scrollWidth-innerWidth,body:document.body.scrollWidth-innerWidth,page:document.querySelector('.menu-page').scrollWidth-innerWidth,focus:document.activeElement.id}})()`);
  assert(m.cards.every(c=>c>=minCard),label+" cards "+m.cards);assert.deepEqual(m.small,[],label+" text under 16px");
  assert(m.targets.every(([a,b])=>a>=44&&b>=44),label+" targets "+JSON.stringify(m.targets));assert(m.overflow<=0&&m.page<=0,label+" overflow");assert.equal(m.focus,'menu-back');
  await shot(label+"-default");
  // select Mounted Billy: details readable
  await click('[data-card=cowboy-mounted-billy].deck-choice');
  const det=await ev(`document.querySelector('.wb-detail').textContent`);assert(/2 friendly troops/.test(det)&&/3 attack/.test(det),det);
  // add/remove: remove Billy -> 11, save blocked
  await click('button[aria-label="Remove Billy"]');
  assert.equal(await ev(`document.getElementById('save-deck').disabled`),true);
  assert.match(await ev(`document.querySelector('.deck-total').textContent+' '+document.querySelector('.deck-validation').textContent`),/11 \/ 12.*exactly 12/);
  await shot(label+"-invalid");
  await click('button[aria-label="Add Deadeye"]');await click('#save-deck');
  const saved=await ev(`JSON.parse(localStorage.getItem('cvw-player-v1')).deck`);
  assert.deepEqual(saved,{"cowboy-sheriff":6,"cowboy-billy":2,"cowboy-mounted-billy":1,"cowboy-deadeye":3});
  assert.match(await ev(`document.querySelector('.deck-feedback').textContent`),/Deck saved/);
  await shot(label+"-saved");
  // keyboard: Tab to a tile and Enter selects; Escape goes home with focus restored
  await ev(`document.querySelector('[data-card=cowboy-deadeye].deck-choice').focus()`);await key('Enter','Enter',13);
  assert.match(await ev(`document.querySelector('.wb-detail h3').textContent`),/Deadeye/);
  await key('Escape','Escape',27);assert.equal(await ev(`document.activeElement.id`),'menu-deck');
  // reload persistence
  await s("Page.navigate",{url});await until(`document.querySelector('#title-screen')?.dataset.ready==='true'`);await click('#menu-deck');await until(`document.querySelectorAll('.deck-row').length===4`);
  assert.equal(await ev(`document.querySelector('.deck-row[data-card=cowboy-deadeye] output').textContent`),'3');
  await shot(label+"-reloaded");
  report.viewports.push({label,...m});
 }
 console.log(JSON.stringify(report,null,1));
}finally{sock.close();child.kill("SIGTERM");await sleep(500);await rm(profile,{recursive:true,force:true,maxRetries:5});}

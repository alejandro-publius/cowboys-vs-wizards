import * as T from "three";
import {createDuel,loadAssets,timings} from "./render/scene.js";
import {createMatchBoard} from "./render/match-board.js";
import {withCues} from "./render/cues.js";
import {withClashReady} from "./render/clash-ready.js";
import {createScheduler} from "./match/scheduler.js";
import {createController} from "./match/controller.js";
import {mountCards} from "./ui/cards.js";
import {cardModel} from "./ui/card-model.js";
const get=id=>document.getElementById(id);
const end={fire:timings.fireEnd,cast:timings.castEnd,exchange:timings.end};
const cues={
  shot:"Billy fires.",
  "bullet-impact":"Billy’s shot hits the wizard.",
  charge:"Singularity pulls Billy off his tile.",
  release:"The wizard releases Singularity.",
  "spell-impact":"The blast throws Billy across the lane.",
  landing:"Billy hits the board."
};

function sound(context,name){
  const envelope={
    shot:[.34,.23,205,43,.83],
    "bullet-impact":[.26,.13,130,54,.31],
    charge:[.77,.065,310,72,.21],
    release:[.58,.16,151,38,.62],
    "spell-impact":[.37,.12,110,36,.55],
    landing:[.39,.19,116,32,.50]
  };
  const [duration,volume,high,low,noiseAmount]=envelope[name];
  const rate=context.sampleRate, buffer=context.createBuffer(1,Math.round(rate*duration),rate),data=buffer.getChannelData(0);
  let phase=0,noise=0;
  for(let i=0;i<data.length;i++){
    const u=i/data.length;
    noise=.55*noise+.45*(2*Math.random()-1);
    phase+=2*Math.PI*T.MathUtils.lerp(high,low,u)/rate;
    const tone=Math.sin(phase)+.31*Math.sin(2*phase)*Math.exp(-u*4);
    data[i]=volume*Math.min(1,i/40)*Math.exp(-u*7)*(tone+noiseAmount*noise*2.1);
  }
  const source=context.createBufferSource();
  source.buffer=buffer;source.connect(context.destination);source.start();
}
function refreshHealth(state){
  for(const name of ["wizard","billy"]){
    const value=state.health[name],display=get(name+"-hp");
    if(display.textContent!==String(value))display.textContent=String(value);
    get(name+"-meter").value=value;
  }
}
function recording(){
  const encoded=get("video-data").textContent, decoded=atob(encoded);
  const bytes=new Uint8Array(decoded.length);
  for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
  get("recording").src=URL.createObjectURL(new Blob([bytes],{type:"video/mp4"}));
  get("boot").hidden=true;get("fallback").hidden=false;
}
async function launch(){
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.08;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.35));
  // The models are parsed once and shared by the attack demo and the card match.
  const models=await loadAssets(JSON.parse(get("models").textContent));
  const duel=await createDuel(models);
  const scheduler=createScheduler();
  const board=await createMatchBoard({models,scheduler});
  get("models").remove();
  const stage=get("stage");
  stage.append(renderer.domElement);
  function size(){
    const width=Math.max(1,stage.clientWidth),height=Math.max(1,stage.clientHeight);
    renderer.setSize(width,height,false);
    duel.camera.aspect=width/height;
    duel.camera.fov=width/height<1?59:40;
    duel.camera.updateProjectionMatrix();
    board.resize(width,height);
  }
  new ResizeObserver(size).observe(stage);
  size();
  let active=false,previous=0,ticks=0,context=null,enabled=false,frameId=0;
  // "match" (Orb Duel card match, the default) or "demo" (the attack demo).
  let appMode=null;
  const moves=[get("fire"),get("cast"),get("watch")],status=get("status");
  const useControls=playing=>{active=playing;for(const button of moves)button.disabled=playing;};
  const message=text=>{if(status.textContent!==text)status.textContent=text;};
  function start(mode){
    if(active)return;
    duel.reset(mode);ticks=0;useControls(true);refreshHealth(duel.state());
    message(mode==="cast"?"The wizard raises his staff.":"Billy reaches for his revolver.");
  }
  function resetDemo(){
    duel.reset();ticks=0;useControls(false);refreshHealth(duel.state());
    message("Choose an attack or play the exchange.");
  }
  get("sound").addEventListener("click",async()=>{
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return;
    enabled=!enabled;
    if(enabled){context??=new Audio();await context.resume();}
    get("sound").setAttribute("aria-pressed",String(enabled));
    get("sound").textContent=enabled?"Mute":"Sound";
  });
  get("camera").addEventListener("click",()=>{
    duel.view.duel=!duel.view.duel;
    get("camera").setAttribute("aria-pressed",String(duel.view.duel));
    get("camera").textContent=duel.view.duel?"Duel camera":"Board camera";duel.draw();
  });
  get("reset").addEventListener("click",resetDemo);
  get("fire").addEventListener("click",()=>start("fire"));
  get("cast").addEventListener("click",()=>start("cast"));
  get("watch").addEventListener("click",()=>start("exchange"));
  document.addEventListener("keydown",event=>{
    if(appMode!=="demo"||get("controls").hidden||event.repeat||event.metaKey||event.altKey||event.ctrlKey)return;
    if(event.key==="1")start("fire");
    if(event.key==="2")start("cast");
    if(event.code==="Space"&&event.target===document.body){event.preventDefault();start("exchange");}
  });

  // Orb Duel card match: the controller holds the Engine state and drives the
  // match board (with the Billy and Wizard cues) and the card overlay.
  let controller=null;
  function showMatch(){
    if(!controller)return;
    const state=controller.status(),options=controller.options();
    overlay.render(cardModel({displayed:controller.displayed(),options,status:state,
      seed:controller.seed(),seedPinned:controller.seedPinned(),message:controller.message()}));
    board.highlight(state==="accepting_input"&&options?{cowboy:options.ownSlots,wizard:options.enemySlots}:{});
  }
  const overlay=mountCards(get("match"),{
    onCard:cardId=>controller.input({type:"card",cardId}),
    onSlot:(side,slot)=>controller.input({type:"slot",side,slot}),
    onConfirm:()=>controller.input({type:"confirm"}),
    onCancel:()=>controller.input({type:"cancel"}),
    onSkip:()=>controller.input({type:"skip"}),
    onEndPhase:()=>controller.endPhase(),
    onRestart:()=>controller.restart(),
    onReplaySeed:text=>controller.start(text)
  });
  controller=createController({scheduler,renderer:withClashReady(withCues(board)),onChange:showMatch});
  const params=new URLSearchParams(location.search);
  // ?closeup=cowboy-0 (or cowboy-0-wide) views one tile from the front, to check a model.
  const closeup=/^(cowboy|wizard)-([0-2])(-wide)?$/.exec(params.get("closeup")??"");
  if(closeup)board.closeUp(closeup[1],Number(closeup[2]),Boolean(closeup[3]));
  function startMatch(){
    scheduler.tick(performance.now());
    if(!controller.start(params.get("seed")??undefined))controller.start();
  }
  renderer.domElement.addEventListener("pointerdown",event=>{
    if(appMode!=="match"||event.button!==0)return;
    const box=renderer.domElement.getBoundingClientRect();
    const hit=board.pick((event.clientX-box.left)/box.width*2-1,1-(event.clientY-box.top)/box.height*2);
    if(hit)controller.input({type:"slot",side:hit.side,slot:hit.slot});
  });
  document.addEventListener("keydown",event=>{
    if(appMode==="match"&&event.key==="Escape")controller.input({type:"cancel"});
  });
  function setMode(next){
    if(next===appMode)return;
    if(appMode==="match")controller.leave();
    if(appMode==="demo")resetDemo();
    appMode=next;
    const match=next==="match";
    get("match").hidden=!match;
    get("controls").hidden=match;get("tools").hidden=match;
    get("mode").textContent=match?"Attack demo":"Card match";
    if(match)startMatch();
    else{previous=0;ticks=0;}
  }
  get("mode").addEventListener("click",()=>setMode(appMode==="match"?"demo":"match"));

  renderer.domElement.addEventListener("webglcontextlost",event=>{
    event.preventDefault();cancelAnimationFrame(frameId);get("tools").hidden=true;get("controls").hidden=true;
    get("modes").hidden=true;get("match").hidden=true;controller.leave();
    renderer.domElement.remove();recording();
  },{once:true});
  get("boot").hidden=true;get("modes").hidden=false;
  setMode(params.get("mode")==="demo"?"demo":"match");
  function frame(now){
    if(appMode==="match"){
      try{scheduler.tick(now);}catch(error){console.error(error);}
      renderer.render(board.scene,board.camera);
      frameId=requestAnimationFrame(frame);
      return;
    }
    ticks+=previous ? Math.min(.05,(now-previous)/1000):0;
    previous=now;
    const dt=1/60;
    while(ticks>=dt){
      if(!active&&duel.state().mode!=="idle"){ticks=0;break;}
      duel.step(dt);ticks-=dt;
      for(const event of duel.events.splice(0)){message(cues[event]);if(enabled)sound(context,event);}
      const state=duel.state();
      if(active){
        refreshHealth(state);
        if(state.elapsed>=end[state.mode]){
          useControls(false);
          message(state.mode==="exchange"?"Exchange complete.":"Attack complete.");
        }
      }
    }
    renderer.render(duel.scene,duel.camera);
    frameId=requestAnimationFrame(frame);
  }
  frameId=requestAnimationFrame(frame);
}
launch().catch(error=>{console.error(error);recording();});

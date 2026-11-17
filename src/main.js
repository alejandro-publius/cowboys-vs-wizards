import {perimeterModelNames} from "./render/model-assets.js";
import * as T from "three";
import {addPerimeter, loadGroundTexture} from "./render/perimeter.js";
import {createDuel,loadAssets,timings} from "./render/scene.js";
import {createMatchBoard} from "./render/match-board.js";
import {withCues} from "./render/cues.js";
import {withClashReady} from "./render/clash-ready.js";
import {withGraveyards} from "./render/graveyards.js";
import {createScheduler} from "./match/scheduler.js";
import {createController,FABLE_ENGINE} from "./match/controller.js";
import {cpuFor} from "./game/cpu.js";
import {openingMatch,parseOpeningParams} from "./game/opening-policy.js";
import {mountCards} from "./ui/cards.js";
import {cardModel} from "./ui/card-model.js";
import {mountTitleMenu} from "./ui/title-menu.js";
import {createProfileStore} from "./profile/player-profile.js";
import {createMatch} from "./game/state.js";
import {deckIds,validateDeck} from "./game/deck-builder.js";
const get=id=>document.getElementById(id);
const profile=createProfileStore();
let game=null,launching=null;
function applyPreferences(settings){
  document.documentElement.classList.toggle("reduce-card-motion",settings.reducedMotion);
  game?.configure(settings);
}
const menu=mountTitleMenu(get("title-screen"),{
  profile,
  async onPlay(){
    if(!game){
      launching??=launch();
      try{game=await launching;}finally{launching=null;}
    }
    menu.hide();get("arena").hidden=false;game.enter();
  },
  onSettings:applyPreferences
});
applyPreferences(profile.get().settings);
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
  const video=get("video-data");
  if(video.dataset.src)get("recording").src=video.dataset.src;
  else{
    const decoded=atob(video.textContent),bytes=new Uint8Array(decoded.length);
    for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
    get("recording").src=URL.createObjectURL(new Blob([bytes],{type:"video/mp4"}));
  }
  get("boot").hidden=true;get("fallback").hidden=false;
}
async function launch(){
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.08;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.35));
  // The models are parsed once and shared by the attack demo and the card match.
  const source=JSON.parse(get("models").textContent);
  const [models,corners,ground]=await Promise.all([
    loadAssets(source),
    loadAssets(source,perimeterModelNames),
    loadGroundTexture()
  ]);
  // The exchange scene (and Rapier) is created on first demand and then reused.
  let duel=null,duelLoading=null,lost=false;
  const scheduler=createScheduler();
  const board=await createMatchBoard({models,scheduler});
  addPerimeter(board.scene,corners,ground);
  get("models").remove();
  const stage=get("stage");
  stage.append(renderer.domElement);
  let overlay=null;
  // "match" (Orb Duel card match, the default) or "demo" (the attack demo).
  let appMode=null;
  function size(){
    const width=Math.max(1,stage.clientWidth),height=Math.max(1,stage.clientHeight);
    renderer.setSize(width,height,false);
    if(duel){
      duel.camera.aspect=width/height;
      duel.camera.fov=width/height<1?59:40;
      duel.camera.updateProjectionMatrix();
    }
    // The stage runs under the hand; keep the board framed above it.
    const tray=Math.min(height-1,Number.parseFloat(getComputedStyle(stage).paddingBottom));
    board.resize(width,height,tray);
    overlay?.layout();
  }
  new ResizeObserver(size).observe(stage);
  size();
  let active=false,previous=0,ticks=0,context=null,enabled=false,frameId=0;
  let pausedAt=null,pausedTotal=0,matchRun=0,pausedAnimations=[];
  const moves=[get("fire"),get("cast"),get("watch")],status=get("status");
  const useControls=playing=>{active=playing;for(const button of moves)button.disabled=playing;};
  const message=text=>{if(status.textContent!==text)status.textContent=text;};
  function start(mode){
    if(active||!duel)return;
    duel.reset(mode);ticks=0;useControls(true);refreshHealth(duel.state());
    message(mode==="cast"?"The wizard raises his staff.":"Billy reaches for his revolver.");
  }
  function resetDemo(){
    if(!duel)return;
    duel.reset();ticks=0;useControls(false);refreshHealth(duel.state());
    message("Choose an attack or play the exchange.");
  }
  function configure(settings){
    renderer.setPixelRatio(settings.performance==="low"?.85:Math.min(window.devicePixelRatio||1,1.35));
    renderer.shadowMap.enabled=settings.performance!=="low";
    enabled=settings.sound;
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(enabled&&Audio){context??=new Audio();context.resume().catch(()=>{});}
    if(!Audio)enabled=false;
    get("sound").setAttribute("aria-pressed",String(enabled));
    get("sound").textContent=enabled?"Mute":"Sound";
    size();
  }
  get("sound").addEventListener("click",()=>{
    profile.updateSettings({sound:!enabled});applyPreferences(profile.get().settings);
  });
  get("camera").addEventListener("click",()=>{
    if(!duel)return;
    duel.view.duel=!duel.view.duel;
    get("camera").setAttribute("aria-pressed",String(duel.view.duel));
    get("camera").textContent=duel.view.duel?"Duel camera":"Board camera";duel.draw();
  });
  get("reset").addEventListener("click",resetDemo);
  get("fire").addEventListener("click",()=>start("fire"));
  get("cast").addEventListener("click",()=>start("cast"));
  get("watch").addEventListener("click",()=>start("exchange"));
  document.addEventListener("keydown",event=>{
    if(pausedAt!==null||get("arena").hidden||appMode!=="demo"||get("controls").hidden||event.repeat||event.metaKey||event.altKey||event.ctrlKey)return;
    if(event.key==="1")start("fire");
    if(event.key==="2")start("cast");
    if(event.code==="Space"&&event.target===document.body){event.preventDefault();start("exchange");}
  });

  // Orb Duel card match: the controller holds the Engine state and drives the
  // match board (with the Billy and Wizard cues) and the card overlay.
  let controller=null;
  // The graveyards react when the Presenter's displayed discard lists grow.
  const cued=withGraveyards(withClashReady(withCues(board)));
  // Starts the 3D summon, tells the overlay its cue, and returns the cue as is.
  const matchView={...cued,summon(spec){
    const cue=cued.summon(spec);
    overlay?.summonStarted(spec,cue);
    return cue;
  }};
  function showMatch(){
    if(!controller)return;
    const state=controller.status(),options=controller.options(),displayed=controller.displayed();
    if(state==="terminal"&&displayed?.result)profile.record("match-complete",{matchId:matchRun,won:displayed.result.outcome==="win"});
    matchView.discards(displayed);
    overlay.render(cardModel({displayed,options,status:state,
      seed:controller.seed(),seedPinned:controller.seedPinned(),message:controller.message()}));
    board.highlight(state==="accepting_input"&&options?{cowboy:options.ownSlots,wizard:options.enemySlots}:{});
  }
  function projectPoint(point) {
    const box=renderer.domElement.getBoundingClientRect();
    board.camera.updateMatrixWorld();
    const p=point.project(board.camera);
    return {x:box.left+(p.x+1)*box.width/2,y:box.top+(1-p.y)*box.height/2};
  }
  overlay=mountCards(get("match"),{
    slotTarget:(side,slot)=>{
      const tile=board.stage.tiles[(side==="wizard"?3:0)+slot];
      if(!tile)return null;
      const corners=[-1.08,1.08].flatMap(x=>[-.915,.915].map(z=>projectPoint(new T.Vector3(tile.x+x,tile.top,tile.z+z))));
      const left=Math.min(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y));
      return {left,top,width:Math.max(...corners.map(p=>p.x))-left,height:Math.max(...corners.map(p=>p.y))-top};
    },
    deckTarget:side=>{
      const [x,z]=side==="cowboy"?[4.85,3.75]:[-4.85,-3.75];
      const p=projectPoint(new T.Vector3(x,board.stage.deck+.12,z));
      const width=Math.max(42,Math.min(78,renderer.domElement.clientWidth*.05));
      return {left:p.x-width/2,top:p.y-width*.7,width,height:width*1.4};
    },
    onCard:cardId=>controller.input({type:"card",cardId}),
    onSlot:(side,slot)=>controller.input({type:"slot",side,slot}),
    onConfirm:()=>controller.input({type:"confirm"}),
    onCancel:()=>controller.input({type:"cancel"}),
    onSkip:()=>controller.input({type:"skip"}),
    onEndPhase:()=>controller.endPhase(),
    onRestart:()=>controller.restart(),
    onReplaySeed:text=>controller.start(text),
    // Screen rect of the Cowboy tile for slot, projected through the board camera.
    summonTarget:slot=>{
      const tile=board.stage.tiles[slot];
      if(!tile||tile.faction!=="cowboy")return null;
      const box=renderer.domElement.getBoundingClientRect();
      if(!(box.width>0&&box.height>0))return null;
      // board.camera is the camera the match renders with (see frame()).
      board.camera.updateMatrixWorld();
      const p=new T.Vector3(tile.x,tile.top,tile.z).project(board.camera);
      if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z)||p.z<-1||p.z>1)return null;
      const size=Math.max(24,box.width*.06);
      return {left:box.left+(p.x+1)/2*box.width-size/2,top:box.top+(1-p.y)/2*box.height-size/2,width:size,height:size};
    }
  });
  const params=new URLSearchParams(location.search);
  // ?opening=shipped|both[&first=cowboy|wizard] opts into the local opening A/B; otherwise the default engine runs.
  const opening=parseOpeningParams(params);
  const engine={...FABLE_ENGINE,
    createMatch(seed){
      matchRun++;
      const counts=params.get("deck")==="starter"?null:profile.get().deck;
      const options=counts&&validateDeck(counts).ok?{cowboyDeck:deckIds(counts)}:{};
      return opening?openingMatch(seed,opening.opening,opening.first,options):createMatch(seed,options);
    },
    applyAction(state,action){
      const result=FABLE_ENGINE.applyAction(state,action);
      if(result.ok&&action.side==="cowboy"){
        const id=matchRun+":"+result.state.revision;
        if(action.type==="summon")profile.record("summon",{id});
        if(action.type==="cast")profile.record("spell",{id});
      }
      return result;
    }
  };
  // ?cpu=easy|hard previews a Wizard difficulty level; anything else is the normal opponent.
  controller=createController({engine,scheduler,renderer:matchView,onChange:showMatch,chooseCpuAction:cpuFor(params.get("cpu"))});
  // ?closeup=cowboy-0 (or cowboy-0-wide) views one tile from the front, to check a model.
  const closeup=/^(cowboy|wizard)-([0-2])(-wide)?$/.exec(params.get("closeup")??"");
  if(closeup)board.closeUp(closeup[1],Number(closeup[2]),Boolean(closeup[3]));
  function startMatch(){
    scheduler.tick(performance.now()-pausedTotal);
    if(!controller.start(params.get("seed")??undefined))controller.start();
  }
  renderer.domElement.addEventListener("pointerdown",event=>{
    if(appMode!=="match"||event.button!==0)return;
    const box=renderer.domElement.getBoundingClientRect();
    const hit=board.pick((event.clientX-box.left)/box.width*2-1,1-(event.clientY-box.top)/box.height*2);
    if(hit)controller.input({type:"slot",side:hit.side,slot:hit.slot});
  });
  document.addEventListener("keydown",event=>{
    if(pausedAt!==null||get("arena").hidden||appMode!=="match"||event.key!=="Escape"||event.repeat||event.defaultPrevented||event.isComposing)return;
    const target=event.target;
    if(document.querySelector("dialog[open]")||
      (target instanceof Element&&(target.closest("input,textarea,select")||target.isContentEditable)))return;
    if(controller.status()!=="accepting_input"||!controller.options()?.canCancel)return;
    controller.input({type:"cancel"});
    event.preventDefault();
  });
  function setMode(next){
    if(next===appMode)return;
    if(appMode==="match"){overlay.cancelSummon();controller.leave();}
    if(appMode==="demo")resetDemo();
    appMode=next;
    const match=next==="match";
    get("arena").classList.toggle("is-match",match);
    get("match").hidden=!match;
    size();
    get("controls").hidden=match;get("tools").hidden=match;
    get("mode").textContent=match?"Attack demo":"Card match";
    if(match)startMatch();
    else{previous=0;ticks=0;}
  }
  // Switching to the demo creates the exchange scene first; the match stays
  // rendered meanwhile, and a failed load leaves the match active and retryable.
  async function loadDuel(){
    duelLoading=createDuel(models);
    try{
      duel=await duelLoading;
    }catch(error){
      console.error(error);
      duel=null;
    }finally{
      duelLoading=null;
    }
    return Boolean(duel);
  }
  async function requestMode(next){
    if(lost)return;
    if(next==="match"||duel){setMode(next);return;}
    if(duelLoading)return;
    const button=get("mode");
    button.disabled=true;
    const loaded=await loadDuel();
    button.disabled=false;
    if(loaded&&!lost)setMode("demo");
  }
  get("mode").addEventListener("click",()=>requestMode(appMode==="match"?"demo":"match"));

  renderer.domElement.addEventListener("webglcontextlost",event=>{
    event.preventDefault();lost=true;cancelAnimationFrame(frameId);get("tools").hidden=true;get("controls").hidden=true;
    get("modes").hidden=true;get("match").hidden=true;controller.leave();
    renderer.domElement.remove();recording();
  },{once:true});
  // Direct ?mode=demo boots into the exchange; the match is the fallback.
  const bootDemo=params.get("mode")==="demo"&&await loadDuel();
  if(lost)return;
  get("boot").hidden=true;get("modes").hidden=false;
  setMode(bootDemo?"demo":"match");
  pausedAt=performance.now();
  function frame(now){
    if(pausedAt!==null){frameId=requestAnimationFrame(frame);return;}
    if(appMode==="match"){
      try{scheduler.tick(now-pausedTotal);}catch(error){console.error(error);}
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
  get("home").addEventListener("click",()=>{
    if(pausedAt===null)pausedAt=performance.now();
    pausedAnimations=get("arena").getAnimations({subtree:true}).filter(animation=>animation.playState==="running");
    for(const animation of pausedAnimations)animation.pause();
    for(const dialog of document.querySelectorAll("dialog[open]"))dialog.close();
    get("arena").hidden=true;
    menu.show({resume:appMode==="match"&&controller.status()!=="terminal"});
  });
  return {
    configure,
    enter(){
      if(pausedAt!==null){pausedTotal+=performance.now()-pausedAt;pausedAt=null;}
      for(const animation of pausedAnimations)if(animation.effect?.target?.isConnected)animation.play();
      pausedAnimations=[];
      previous=0;configure(profile.get().settings);
      if(appMode==="match"&&controller.status()==="terminal")startMatch();
      size();get("home").focus();
    }
  };
}
// Explicit deep links retain the attack demo and direct-match workflows.
if(["demo","match"].includes(new URLSearchParams(location.search).get("mode")))get("menu-play").click();

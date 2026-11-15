import * as T from "three";
import {createDuel,loadAssets,timings} from "./scene.js";
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
  const duel=await createDuel(await loadAssets(JSON.parse(get("models").textContent)));
  get("models").remove();
  const stage=get("stage");
  stage.append(renderer.domElement);
  function size(){
    const width=Math.max(1,stage.clientWidth),height=Math.max(1,stage.clientHeight);
    renderer.setSize(width,height,false);
    duel.camera.aspect=width/height;
    duel.camera.fov=width/height<1?59:40;
    duel.camera.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(stage);
  size();
  let active=false,previous=0,ticks=0,context=null,enabled=false,frameId=0;
  const moves=[get("fire"),get("cast"),get("watch")],status=get("status");
  const useControls=playing=>{active=playing;for(const button of moves)button.disabled=playing;};
  const message=text=>{if(status.textContent!==text)status.textContent=text;};
  function start(mode){
    if(active)return;
    duel.reset(mode);ticks=0;useControls(true);refreshHealth(duel.state());
    message(mode==="cast"?"The wizard raises his staff.":"Billy reaches for his revolver.");
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
  get("reset").addEventListener("click",()=>{
    duel.reset();ticks=0;useControls(false);refreshHealth(duel.state());
    message("Choose an attack or play the exchange.");
  });
  get("fire").addEventListener("click",()=>start("fire"));
  get("cast").addEventListener("click",()=>start("cast"));
  get("watch").addEventListener("click",()=>start("exchange"));
  document.addEventListener("keydown",event=>{
    if(get("controls").hidden||event.repeat||event.metaKey||event.altKey||event.ctrlKey)return;
    if(event.key==="1")start("fire");
    if(event.key==="2")start("cast");
    if(event.code==="Space"&&event.target===document.body){event.preventDefault();start("exchange");}
  });
  renderer.domElement.addEventListener("webglcontextlost",event=>{
    event.preventDefault();cancelAnimationFrame(frameId);get("tools").hidden=true;get("controls").hidden=true;
    renderer.domElement.remove();recording();
  },{once:true});
  get("boot").hidden=true;get("controls").hidden=false;get("tools").hidden=false;
  function frame(now){
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

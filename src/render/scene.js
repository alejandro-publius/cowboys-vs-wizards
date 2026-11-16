import * as T from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import Rapier from "@dimforge/rapier3d-compat";
import physics from "../physics/gravity.cjs";
import {rigActor, grip, pose, pointOn, wizardStaffGrip} from "./rig.js";

export const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export const assets=["board","cowboy-tile","wizard-tile","saloon","gateway","billy","wizard","revolver","sheriff","dragon","mounted-billy","skeleton"];
export const timings={shot:.77,impact:.86,fireEnd:1.58,well:.55,release:2.30,repulse:2.43,land:3.02,castEnd:3.69,
  drawStart:.48,castStart:2.28,end:6.16};
const mix=T.MathUtils.lerp;
const ease=(from,to,value)=>T.MathUtils.smoothstep(value,from,to);
const pulse=(t,from,peak,to)=>ease(from,peak,t)*(1-ease(peak,to,t));
const vec=({x,y,z})=>v(x,y,z);
const obj=({x,y,z})=>({x,y,z});

function decode(data){
  if(typeof data!=="string")return data;
  if(typeof Uint8Array.fromBase64==="function")return Uint8Array.fromBase64(data);
  const raw=atob(data),bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return bytes;
}

function modelBuffer(input){
  const bytes=decode(input);
  return bytes.byteOffset===0&&bytes.byteLength===bytes.buffer.byteLength
    ?bytes.buffer:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
}

export async function loadAssets(source,names=assets){
  const loader=new GLTFLoader();
  const entries=await Promise.all(names.map(async name=>{
    const input=source[name];
    const model=(input?.url?await loader.loadAsync(input.url):await loader.parseAsync(modelBuffer(input),"")).scene;
    model.traverse(mesh=>{if(mesh.isMesh)mesh.geometry.userData.asset=name;});
    return [name,model];
  }));
  return Object.fromEntries(entries);
}

export function fit(asset, {width,height,depth,x=0,y=0,z=0,yaw=0}){
  const copy=asset.clone(true), box=new T.Box3().setFromObject(copy);
  const center=box.getCenter(v()), size=box.getSize(v());
  copy.position.sub(v(center.x,box.min.y,center.z));
  const parent=new T.Group(), uniform=height/size.y;
  parent.scale.set(width?width/size.x:uniform,uniform,depth?depth/size.z:uniform);
  parent.position.set(x,y,z);
  parent.rotation.y=yaw;
  parent.add(copy);
  copy.traverse(model=>{if(model.isMesh){model.castShadow=true;model.receiveShadow=true;}});
  return parent;
}
export function surface(model,x,z){
  model.updateWorldMatrix(true,true);
  const hit=new T.Raycaster(v(x,9,z),v(0,-1,0),0,16).intersectObject(model,true)[0];
  if(!hit)throw new Error("Unable to seat a piece on the board at "+x+", "+z);
  return hit.point.y;
}
export function setBoard(scene,models){
  const board=fit(models.board,{width:11.65,height:.57,depth:8.15});
  scene.add(board);
  const deck=surface(board,0,0),tiles=[];
  for(const side of [1,-1]){
    const faction=side===1?"cowboy":"wizard",z=side===1?2.32:-2.34;
    for(const [x,width] of [[-2.13,2.34],[.58,2.28],[3.22,2.21]]){
      const tile=fit(models[faction+"-tile"],{width,height:.109,depth:2.07,
        x,y:surface(board,x,z)-.02,z});
      tile.name=faction+"-tile-"+tiles.length;
      scene.add(tile);
      tiles.push({faction,model:tile,x,z,top:surface(tile,x,z)});
    }
  }
  const saloon=fit(models.saloon,{height:2.30,x:-4.49,y:surface(board,-4.49,2.42)-.025,z:2.42,yaw:.03});
  const gate=fit(models.gateway,{width:1.40,height:2.30,x:5.03,y:surface(board,5.03,-2.83)-.024,z:-2.83,yaw:.075});
  scene.add(saloon,gate);
  return {board,deck,tiles,saloon,gate};
}
export function attachPistol(actor,model,size=.225){
  const holder=new T.Group(), p=new T.Group(), prop=model.clone(true), tip=new T.Object3D();
  // Tripo's side-view revolver points along -X. Rotate it into the actor's forward axis.
  const anchor=v(.255,.356,0);
  prop.position.sub(anchor);tip.position.set(-.453,.483,0).sub(anchor);
  p.rotation.y=Math.PI/2;p.scale.setScalar(size);
  p.add(prop,tip);holder.add(p);actor.root.add(holder);
  prop.traverse(node=>{if(node.isMesh)node.castShadow=true;});
  return {holder,tip};
}
export function attachStaff(actor){
  const hand=actor.rig.sides[1];
  const holder=new T.Group(), oak=new T.MeshStandardMaterial({color:0x493023,roughness:.77}),
    brass=new T.MeshStandardMaterial({color:0xbe8d50,roughness:.32,metalness:.66});
  const curve=new T.CatmullRomCurve3([v(.020,-.371),v(.007,-.15),v(),v(-.009,.166),v(-.021,.281),v(.014,.393)]);
  holder.add(new T.Mesh(new T.TubeGeometry(curve,25,.016,10),oak));
  const wrap=new T.Mesh(new T.CylinderGeometry(.019,.019,.131,12),
    new T.MeshStandardMaterial({color:0x3e2a1e,roughness:.94}));
  holder.add(wrap);
  for(const y of [-.095,.087,.319,.361,.402]){
    const band=new T.Mesh(new T.CylinderGeometry(.023,.023,.014,12),brass);
    band.position.set(y>.31?.007:0,y,0);holder.add(band);
  }
  const jewel=new T.Mesh(new T.OctahedronGeometry(.055),new T.MeshStandardMaterial({
    color:0x69d6ab,emissive:0x386e67,emissiveIntensity:.8,roughness:.32,flatShading:true
  }));
  jewel.position.set(.012,.449,0);jewel.scale.y=1.43;holder.add(jewel);
  holder.traverse(node=>{if(node.isMesh)node.castShadow=true;});
  holder.position.copy(wizardStaffGrip).sub(hand.wrist);
  holder.rotation.x=Math.PI/2;
  hand.hand.add(holder);
  return {holder,jewel};
}
function placeDebris(scene,deck){
  const rng=physics.random(846), layout=[],meshes=[];
  const piles=[[-3.80,-.14,true],[3.54,.51,true],[-2.47,-.70,false],[2.38,-.26,false]];
  for(const [x,z,wood] of piles)for(let row=0;row<3;row++)for(let col=0;col<3;col++){
    const h=v(.137+(rng()-.5)*.025,.096,.136);
    const p=v(x+.30*(col-1)+(row%2)*.045,deck+.10+row*.205,z+(rng()-.5)*.05);
    layout.push({p:obj(p),h:obj(h),wood,shade:rng()});
    const color=new T.Color(wood?0xa26138:0x736071).multiplyScalar(.77+.44*rng());
    const g=new T.BoxGeometry(h.x*2,h.y*2,h.z*2,3,3,3);
    const pos=g.getAttribute("position"), point=v(), inset=v();
    const ink=new Float32Array(pos.count*3), bevel=wood?.013:.026;
    for(let i=0;i<pos.count;i++){
      point.fromBufferAttribute(pos,i);
      inset.set(
        T.MathUtils.clamp(point.x,-h.x+bevel,h.x-bevel),
        T.MathUtils.clamp(point.y,-h.y+bevel,h.y-bevel),
        T.MathUtils.clamp(point.z,-h.z+bevel,h.z-bevel));
      const grain=Math.sin(105*point.x+43*point.y+59*point.z);
      const wear=wood?.011:.018;
      point.sub(inset).normalize().multiplyScalar(bevel).add(inset);
      point.y+=grain*wear;
      pos.setXYZ(i,point.x,point.y,point.z);
      const shade=.84+.16*grain;
      ink.set([shade,shade,shade],i*3);
    }
    g.computeVertexNormals();
    g.setAttribute("color",new T.Float32BufferAttribute(ink,3));
    const mesh=new T.Mesh(g,new T.MeshStandardMaterial({color,roughness:.85,vertexColors:true}));
    mesh.position.copy(p);mesh.castShadow=true;mesh.receiveShadow=true;
    scene.add(mesh);meshes.push(mesh);
  }
  return {layout,meshes};
}
export function lighting(scene){
  scene.add(new T.HemisphereLight(0xebdfff,0x81503b,1.73));
  const key=new T.DirectionalLight(0xffe5c3,2.35), rim=new T.DirectionalLight(0xc4acf7,1.30);
  key.position.set(-5.3,8.7,5.0);
  rim.position.set(3.8,6.0,-7.2);
  key.castShadow=true;key.shadow.mapSize.set(1536,1536);
  Object.assign(key.shadow.camera,{left:-8,right:8,top:6.7,bottom:-6.7,near:.1,far:26});
  key.shadow.normalBias=.030;key.shadow.bias=-.0002;
  const flash=new T.PointLight(0xffb96e,0,3.6,2), rift=new T.PointLight(0xb98aff,0,7,2);
  scene.add(key,rim,flash,rift);
  return {flash,rift};
}
export function makeEffects(scene){
  const neon=(color)=>new T.MeshBasicMaterial({color,transparent:true,
    blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
  const shotFlash=new T.Group(), sparkCone=new T.Mesh(new T.ConeGeometry(.068,.195,8),neon(0xffe2ac));
  sparkCone.rotation.x=Math.PI/2;
  sparkCone.position.z=.084;
  shotFlash.add(sparkCone);
  const sparksAtMuzzle=new T.Mesh(new T.IcosahedronGeometry(.053,0),neon(0xffa44a));
  sparksAtMuzzle.scale.set(1.52,1.24,1);
  shotFlash.add(sparksAtMuzzle);
  const tracer=new T.Mesh(new T.CylinderGeometry(.012,.020,1,6),neon(0xffb95e));
  const ripple=new T.Mesh(new T.TorusGeometry(1,.029,7,72),neon(0xc192ff));
  ripple.rotation.x=-Math.PI/2;
  const sparks=Array.from({length:24},(_,i)=>new T.Mesh(new T.IcosahedronGeometry(.036,0),neon(i%3===0?0xd28cff:0xffd279)));
  const well=new T.Group();
  well.add(new T.Mesh(new T.SphereGeometry(1,36,24),new T.MeshBasicMaterial({color:0x030108,toneMapped:false})));
  const diskMaterial=new T.ShaderMaterial({side:T.DoubleSide,transparent:true,depthWrite:false,
    blending:T.AdditiveBlending,toneMapped:false,uniforms:{clock:{value:0}},
    vertexShader:"varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader:"uniform float clock;varying vec2 p;void main(){float r=length(p),q=atan(p.y,p.x);float flow=pow(max(0.,.39+.43*sin(q*8.+r*64.-clock*7.)+.26*sin(q*3.-r*24.+clock*4.6)),1.8);float band=smoothstep(.27,.34,r)*(1.-smoothstep(.51,.99,r));float halo=exp(-pow((r-.34)*19.,2.));vec3 c=mix(vec3(.50,.18,1.),vec3(1.,.64,.28),clamp(halo*.86+flow*.52,0.,1.));gl_FragColor=vec4(c*(1.1+halo*1.55),(.18+flow*.68)*band+.4*halo);}"
  });
  const disk=new T.Mesh(new T.PlaneGeometry(5.4,5.4),diskMaterial);
  disk.rotation.set(-1.13,0,.20);well.add(disk);
  const ring=new T.Mesh(new T.TorusGeometry(1.08,.027,8,64),neon(0xdd9aff));
  well.add(ring);
  const edge=new T.Mesh(new T.TorusGeometry(1.59,.018,7,64),neon(0xffad58));
  edge.rotation.set(-1.05,0,.16);edge.material.opacity=.65;well.add(edge);
  const embers=new T.Group();
  embers.rotation.copy(edge.rotation);
  const fleck=new T.IcosahedronGeometry(.025,0);
  for(let i=0;i<52;i++){
    const ember=new T.Mesh(fleck,neon(i%5===0?0xc595ff:i%3===0?0xffce80:0xee832f));
    const angle=i*2.39996, radius=1.11+(i%11)*.106;
    ember.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius,(i%7-3)*.035);
    ember.rotation.z=angle+Math.PI/2;
    ember.scale.set(2.2+(i%5)*.72,.50+.13*(i%4),.66);
    embers.add(ember);
  }
  well.add(embers);
  const fragments=Array.from({length:14},(_,i)=>new T.Mesh(
    new T.IcosahedronGeometry(.024+(i%3)*.007,0),
    new T.MeshBasicMaterial({color:i%2===0?0xb18461:0xd09d72,transparent:true,depthWrite:false})
  ));
  const elements=[shotFlash,tracer,ripple,well,...sparks,...fragments];
  elements.forEach(mesh=>{mesh.visible=false;scene.add(mesh);});
  return {shotFlash,tracer,ripple,sparks,well,diskMaterial,embers,fragments};
}
export const drawKeys=[
  [0,[-.221,.468,.026],0],[.22,[-.233,.437,.031],.78],[.34,[-.168,.445,-.036],1],
  [.45,[-.179,.547,.012],1],[.66,[-.139,.623,.178],.83],[.775,[-.132,.642,.214],.71],
  [.83,[-.137,.676,.163],.66],[.98,[-.131,.625,.196],.72],[1.19,[-.182,.532,.082],.9],
  [1.37,[-.168,.445,-.036],1],[1.58,[-.221,.468,.026],0]
];
export const staffKeys=[
  [0,[.263,.430,.125],.79],[.30,[.219,.559,.139],.77],[.55,[.210,.508,.190],.93],
  [1.53,[.232,.505,.179],.88],[2.12,[.197,.559,.133],.92],[2.30,[.219,.499,.204],.93],
  [2.51,[.223,.457,.176],.88],[3.11,[.247,.441,.140],.81],[3.69,[.263,.430,.125],.79]
];
function flight(t,home,landing) {
  const pull=ease(.87,1.94,t);
  const time=T.MathUtils.clamp((t-timings.release)/(timings.land-timings.release),0,1);
  const travel=1-(1-time)**1.14;
  const carried=t<timings.release;
  const height=carried?1.19*pull:(1-time)*(1.19+3.18*time);
  const forward=carried?-1.08*pull:mix(-1.08,landing.z-home.z,travel);
  const sideways=carried?.21*pull:mix(.21,landing.x-home.x,travel);
  const tilt=ease(.055,.29,height);
  const launch=pulse(t,timings.release,2.58,timings.land);
  return {
    position:v(home.x+sideways,mix(home.y,landing.y,travel)+height,home.z+forward),
    height,
    tilt,
    launch,
    pitch:(.16*pull-.64*launch)*tilt,
    yaw:Math.PI+(.23*pull-.57*launch)*tilt,
    roll:(-.21*pull+.38*launch+.07*Math.sin(t*11)*pull)*tilt
  };
}
function reachingArm(side,amount,throwback){
  const sign=side.sign;
  const reach=v(sign*(.236+.042*throwback),.572-.052*throwback,.166-.24*throwback);
  if(amount<=.002)return null;
  return {goal:side.wrist.clone().lerp(reach,amount),bend:.84*amount,roll:[-.15*amount,.48*sign*amount,-.39*sign*amount]};
}
function kickingLegs(amount,throwback,t){
  const alternating=Math.sin(t*8.6)*.13;
  return [-1,1].map(sign=>({
    thigh:[amount*(-.60+.27*throwback+sign*alternating),.10*amount*sign,-.25*amount*sign],
    shin:[amount*(.73-.39*throwback+sign*alternating),0,0],
    foot:[-.24*amount,0,0]
  }));
}
export function motion(keys,t,turn){
  if(t<=0||t>=keys.at(-1)[0])return null;
  const i=keys.findIndex(([time])=>time>=t);
  const [start,first,bend1]=keys[i-1],[end,last,bend2]=keys[i];
  const u=ease(start,end,t),strength=mix(bend1,bend2,u);
  return {goal:v(...first).lerp(v(...last),u),bend:strength,roll:turn.map(axis=>axis*strength)};
}
function times(mode,t){
  if(mode==="exchange")return [t-timings.drawStart,t-timings.castStart];
  return [mode==="fire"?t:-1,mode==="cast"?t:-1];
}

export async function createDuel(models){
  await Rapier.init();
  const scene=new T.Scene();
  scene.background=new T.Color(0x27202a);
  scene.fog=new T.FogExp2(0x27202a,.025);
  const floor=new T.Mesh(new T.PlaneGeometry(120,120),new T.MeshStandardMaterial({color:0x352630,roughness:.98}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.039;floor.receiveShadow=true;scene.add(floor);
  const stage=setBoard(scene,models), light=lighting(scene), effects=makeEffects(scene);
  const billy=rigActor(models.billy,"billy",1.93),wizard=rigActor(models.wizard,"wizard",2.02);
  const [near,far]=[stage.tiles[1],stage.tiles[4]];
  const home=v(near.x,near.top,near.z);
  const landing=v(near.x+.13,0,near.z+.635);
  landing.y=surface(near.model,landing.x,landing.z);
  billy.root.position.copy(home);billy.root.rotation.y=Math.PI;
  wizard.root.position.set(far.x,far.top,far.z);
  scene.add(billy.root,wizard.root);
  const gun=attachPistol(billy,models.revolver),staff=attachStaff(wizard);
  pose(billy,{right:motion(drawKeys,.34,[-.13,.12,-.22])});
  const holster=grip(billy,"right");
  const debris=placeDebris(scene,stage.deck);
  const stageWell=v(.58,stage.deck+.83,.09), opts={layout:debris.layout,floorY:stage.deck,sheriffHome:obj(billy.root.position)};
  let sim=physics.createSimulation(Rapier,opts);
  const camera=new T.PerspectiveCamera(40,16/9,.1,80),events=[],view={duel:true};
  const flags=()=>({fired:false,hit:false,pulled:false,released:false,repulse:false,landed:false});
  let mode="idle",elapsed=0,result=flags(),health={billy:100,wizard:100},shotOrigin=null;
  const muzzle=v(),contact=v();

  function draw(){
    const [shot,cast]=times(mode,elapsed);
    const anticipate=pulse(shot,.03,.35,.65), kick=pulse(shot,.77,.835,1.06);
    const impact=pulse(shot,.86,.96,1.52),pull=pulse(cast,.55,2.17,2.42), push=pulse(cast,2.43,2.65,3.59);
    const caught=flight(cast,home,landing);
    const groundImpact=pulse(cast,timings.land,3.13,3.64);
    billy.root.position.copy(caught.position);
    billy.root.rotation.set(caught.pitch,caught.yaw,caught.roll,"YXZ");
    pose(billy,{
      spine:[.11*anticipate-.13*kick+.14*pull-.19*push+.30*groundImpact,-.15*anticipate+.10*kick,.065*anticipate-.13*push],
      chest:[.007*Math.sin(elapsed*3.3)+.078*anticipate-.18*kick-.13*push,.12*anticipate,-.09*kick],
      head:[.10*anticipate+.075*pull-.13*push,.07*anticipate,-.097*pull+.09*push],
      right:motion(drawKeys,shot,[-.13,.12,-.22])??reachingArm(billy.rig.sides[0],caught.tilt,caught.launch),
      left:reachingArm(billy.rig.sides[1],caught.tilt,caught.launch),
      legs:kickingLegs(caught.tilt,caught.launch,cast)
    });
    const chant=ease(.06,.47,cast)*(1-ease(2.43,3.58,cast));
    const staffArm=motion(staffKeys,cast,[0,0,0])??{goal:v(...staffKeys[0][1]),bend:.79};
    const tipForward=pulse(cast,2.23,2.37,2.82);
    staffArm.roll=[-1.475+.45*chant+.34*tipForward,.06+.22*chant,-.14-.19*chant];
    pose(wizard,{
      spine:[.008-.25*impact+.12*pull,-.11*impact+.07*pull,-.095*impact],
      chest:[-.24*impact+.080*pull,.20*impact,-.13*impact+.049*pull],
      head:[.16*impact-.13*pull,-.09*impact,.07*impact],
      left:staffArm
    });

    const held=shot>=.34&&shot<=1.37;
    gun.holder.position.copy(held?grip(billy,"right"):holster);
    if(held){
      const pitch=mix(1.38,-.08,ease(.34,.68,shot))-.43*kick+1.42*ease(1.04,1.37,shot);
      gun.holder.rotation.set(pitch,-.15*(1-ease(.35,.65,shot)),.066*anticipate);
      if(shot>=.666&&shot<=.785){
        const target=billy.root.worldToLocal(pointOn(wizard,.025,.553,.12));
        const aim=new T.Quaternion().setFromUnitVectors(v(0,0,1),target.sub(gun.holder.position).normalize());
        gun.holder.quaternion.slerp(aim,ease(.666,.765,shot));
      }
    }else gun.holder.rotation.set(1.38,-.15,.066);
    staff.jewel.material.emissiveIntensity=.81+2.7*chant;
    scene.updateMatrixWorld(true);
    gun.tip.getWorldPosition(muzzle);
    contact.copy(pointOn(wizard,.025,.553,.12));
    const flash=pulse(shot,.762,.795,.865), {shotFlash,tracer,ripple,sparks,well,diskMaterial}=effects;
    if((shotFlash.visible=flash>.001)){
      shotFlash.position.copy(muzzle);gun.holder.getWorldQuaternion(shotFlash.quaternion);
      shotFlash.scale.setScalar(.62+flash*.92);
    }
    light.flash.position.copy(muzzle);light.flash.intensity=flash*20;
    if((tracer.visible=shot>=timings.shot&&shot<.925)){
      const origin=shotOrigin??muzzle;
      const travel=ease(timings.shot,timings.impact,shot);
      const first=origin.clone().lerp(contact,Math.max(0,travel-.70)+.52*ease(.86,.93,shot));
      const last=origin.clone().lerp(contact,travel);
      const direction=last.clone().sub(first);
      tracer.position.copy(first).lerp(last,.5);
      tracer.scale.set(1,Math.max(.001,direction.length()),1);
      tracer.quaternion.setFromUnitVectors(v(0,1,0),direction.normalize());
      tracer.material.opacity=.93*(1-ease(.85,.925,shot));
    }
    const since=shot-timings.impact;
    sparks.forEach((mesh,i)=>{
      if(!(mesh.visible=since>=0&&since<.51))return;
      const angle=i*2.4,speed=.63+(i%6)*.13;
      mesh.position.copy(contact).add(v(Math.sin(angle)*since*speed,
        Math.cos(angle)*since*speed-1.7*since**2,.07+since*(i%3)*.14));
      mesh.material.opacity=.86*(1-since/.51);mesh.scale.setScalar(1.05-since);
    });
    if((well.visible=!!sim.hole)){
      const age=sim.hole.age;
      well.position.copy(vec(sim.hole.at));well.scale.setScalar(.095+.46*ease(0,.70,age)+.037*Math.sin(elapsed*4.2)**2);
      well.rotation.z=-.19+.14*Math.sin(elapsed*6);
      diskMaterial.uniforms.clock.value=elapsed;effects.embers.rotation.z=elapsed*1.83;
      light.rift.position.copy(well.position);light.rift.intensity=9+27*ease(0,.90,age);
    }else light.rift.intensity=23*pulse(cast,2.28,2.36,2.70);
    const burst=cast-timings.release;
    if((ripple.visible=burst>=0&&burst<.72)){
      ripple.position.set(stageWell.x,stage.deck+.145,stageWell.z);ripple.scale.setScalar(.27+burst*6.3);
      ripple.material.opacity=.82*(1-burst/.72);
    }
    const landedFor=cast-timings.land;
    effects.fragments.forEach((chip,i)=>{
      if(!(chip.visible=landedFor>=0&&landedFor<.43))return;
      const angle=i*2.39996, speed=.52+.21*(i%5);
      chip.position.copy(landing).add(v(Math.cos(angle)*(landedFor*speed+.09),
        .018+Math.max(0,landedFor*(.65+.09*(i%4))-2.0*landedFor**2),
        Math.sin(angle)*(landedFor*speed+.11)));
      chip.rotation.y=i+landedFor*7;
      chip.material.opacity=.85*(1-landedFor/.43);
      chip.scale.setScalar(1.11-.64*landedFor);
    });
    sim.pieces.forEach((part,i)=>{
      const mesh=debris.meshes[i], q=part.body.rotation();
      mesh.position.copy(vec(part.body.translation()));mesh.quaternion.set(q.x,q.y,q.z,q.w);
    });

    const focus=view.duel&&mode!=="idle" ? .84*ease(0,.76,elapsed)*(1-.24*ease(5.64,timings.end,elapsed)) : 0;
    camera.position.set(3.65,10.10,12.20).lerp(v(10.6,5.42,-1.87),focus);
    const bump=.028*flash+.051*pulse(cast,2.3,2.37,2.62)+.068*pulse(cast,3.01,3.06,3.27);
    camera.position.x+=bump*Math.sin(elapsed*175);camera.position.y+=bump*Math.cos(elapsed*131);
    camera.lookAt(v(.06,-.035,.74).lerp(v(.58,.84,.22),focus));camera.updateMatrixWorld(true);
  }
  function reset(next="idle"){
    sim.dispose();sim=physics.createSimulation(Rapier,opts);
    mode=next;elapsed=0;result=flags();health={billy:100,wizard:100};shotOrigin=null;events.length=0;
    draw();
  }
  function step(dt){
    elapsed+=dt;
    const [shot,cast]=times(mode,elapsed);
    if(!result.fired&&shot>=timings.shot){
      result.fired=true;shotOrigin=gun.tip.getWorldPosition(v());events.push("shot");
    }
    if(!result.hit&&shot>=timings.impact){result.hit=true;health.wizard-=24;events.push("bullet-impact");}
    if(!result.pulled&&cast>=timings.well){
      result.pulled=true;sim.singularity(obj(stageWell));events.push("charge");
    }
    if(!result.released&&cast>=timings.release){result.released=true;sim.releaseSingularity();events.push("release");}
    if(!result.repulse&&cast>=timings.repulse){result.repulse=true;health.billy-=32;events.push("spell-impact");}
    if(!result.landed&&cast>=timings.land){result.landed=true;events.push("landing");}
    if(result.pulled){sim.step();sim.events.length=0;}
    draw();
  }
  const state=()=>({mode,elapsed,health:{...health},...result,affected:sim.pieces.filter(p=>p.dynamic).length});
  draw();
  return {scene,camera,billy,wizard,gun,staff,events,stage,view,reset,step,draw,state,well:effects.well,sim:()=>sim};
}

// The createDuel stage without its actors, physics or debris: the same floor,
// fog, board, tiles, Saloon, Gateway, lighting and board camera. `light` holds
// the flash and rift point lights, both off. Used by the Orb Duel match board.
export async function createBoardScene(models){
  const scene=new T.Scene();
  scene.background=new T.Color(0x27202a);
  scene.fog=new T.FogExp2(0x27202a,.025);
  const floor=new T.Mesh(new T.PlaneGeometry(120,120),new T.MeshStandardMaterial({color:0x352630,roughness:.98}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.039;floor.receiveShadow=true;scene.add(floor);
  const stage=setBoard(scene,models), light=lighting(scene);
  const camera=new T.PerspectiveCamera(40,16/9,.1,80);
  camera.position.set(3.65,10.10,12.20);
  camera.lookAt(v(.06,-.035,.74));camera.updateMatrixWorld(true);
  return {scene,camera,stage,light};
}

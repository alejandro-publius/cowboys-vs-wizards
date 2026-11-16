import {addSourcedFireRing} from './sourced-fire-ring.js';
import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {arenaModelNames,perimeterModelNames} from './model-assets.js';
import {loadAssets,surface} from './scene.js';
import {addPerimeter,loadGroundTexture} from './perimeter.js';
import {createMatchBoard} from './match-board.js';
import {createScheduler} from '../match/scheduler.js';
import {attachStaff,fit} from './scene.js';

// Isolated preview of a sourced clip, using the real board renderer.
// No authored motion or game rules are added here.
async function main(){
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
 renderer.setPixelRatio(1);renderer.setSize(1280,720);document.body.append(renderer.domElement);
 const input=JSON.parse(document.getElementById('preview-models').textContent);
 const config=JSON.parse(document.getElementById('preview-config').textContent);
 const [models,ground]=await Promise.all([loadAssets(input,[...arenaModelNames,...perimeterModelNames,'preview-character']),loadGroundTexture()]);
 const board=await createMatchBoard({models,scheduler:createScheduler()});
 addPerimeter(board.scene,models,ground);board.resize(1280,720);
 const wide={position:board.camera.position.clone(),quaternion:board.camera.quaternion.clone()};
 const tile=board.stage.tiles[config.side==='wizard'?4:1];
 const actor=config.native?fit(models['preview-character'],{height:config.height,yaw:config.yaw}):clone(models['preview-character']);
 if(!config.native){actor.scale.setScalar(config.height);actor.rotation.y=config.yaw;}
 else{
  const size=new T.Box3().setFromObject(actor).getSize(new T.Vector3());
  actor.scale.multiplyScalar(Math.min(1,config.footprint/Math.max(size.x,size.z)));
 }

 actor.position.set(tile.x,tile.top,tile.z);
 let mesh;actor.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}if(o.isSkinnedMesh){mesh=o;o.frustumCulled=false;}});
 if(!mesh)throw Error('Character must retain its skin');
 board.scene.add(actor);
 const clip=config.fireRing?{name:config.clipName,duration:4}:models['preview-character'].animations.find(c=>c.name===config.clipName);
 if(!clip)throw Error('Requested source clip missing');
 const mixer=config.fireRing?null:new T.AnimationMixer(actor);if(mixer){mixer.clipAction(clip).play();mixer.setTime(0);}actor.updateMatrixWorld(true);
 const fireRing=config.fireRing?addSourcedFireRing(board.scene,tile):null;
 const bindPose=config.fireRing?mesh.skeleton.bones.map(b=>[...b.position.toArray(),...b.quaternion.toArray(),...b.scale.toArray()]):null;
 if(config.character==='wizard'){
  const hand=actor.getObjectByName('wizard_left_wrist');
  const staff=attachStaff({rig:{sides:[null,{hand,wrist:new T.Vector3(.278,.397,.072)}]}});
  staff.holder.quaternion.copy(hand.getWorldQuaternion(new T.Quaternion()).invert()).multiply(actor.getWorldQuaternion(new T.Quaternion()));
 }

 const position=mesh.geometry.attributes.position,boots=[];
 if(config.native){
  mesh.skeleton.update();
  const points=[],box=new T.Box3();
  for(let i=0;i<position.count;i++){const point=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);points.push(point);box.expandByPoint(point);}
  const center=box.getCenter(new T.Vector3()),cutoff=box.min.y+(box.max.y-box.min.y)*.13;
  points.forEach((point,i)=>{if(point.y<cutoff)boots.push({i,group:(point.x<center.x?0:2)+(point.z<center.z?0:1)});});
 }else for(let i=0;i<position.count;i++)if(position.getY(i)<.13)boots.push({i,group:(position.getX(i)<0?0:2)+(position.getZ(i)<0?0:1)});

 const point=new T.Vector3();
 let last={};
 function frame(t,view='wide'){
  if(mixer)mixer.setTime(t);if(fireRing)fireRing.frame(t);actor.position.set(tile.x,tile.top,tile.z);actor.updateMatrixWorld(true);mesh.skeleton.update();
  const feet=Array.from({length:4},()=>({point:new T.Vector3(0,Infinity,0),i:-1}));
  for(const {i,group} of boots){
   point.fromBufferAttribute(position,i);mesh.applyBoneTransform(i,point);point.applyMatrix4(mesh.matrixWorld);
   if(point.y<feet[group].point.y){feet[group].point.copy(point);feet[group].i=i;}
  }
  for(let i=feet.length-1;i>=0;i--)if(feet[i].i<0)feet.splice(i,1);
  if(!feet.length)throw Error('No contact candidates');
  const supports=feet.map(({point:p})=>({foot:p.clone(),ground:surface(tile.model,p.x,p.z)}));
  const correction=Math.max(...supports.map(s=>s.ground-s.foot.y))+.003;
  actor.position.y+=correction;actor.updateMatrixWorld(true);mesh.skeleton.update();
  if(view==='close'){
   board.closeUp(config.side,1);board.camera.zoom=config.zoom;board.camera.lookAt(tile.x,tile.top+config.height*.48,tile.z);
  }else{
   board.camera.position.copy(wide.position);board.camera.quaternion.copy(wide.quaternion);board.camera.zoom=1;
  }
  board.camera.updateProjectionMatrix();board.camera.updateMatrixWorld(true);
  if(bindPose){for(let i=0;i<bindPose.length;i++){const b=mesh.skeleton.bones[i],now=[...b.position.toArray(),...b.quaternion.toArray(),...b.scale.toArray()];if(now.some((v,j)=>Math.abs(v-bindPose[i][j])>1e-9))throw Error('Fire preview must not animate Dragon bones');}}
  renderer.render(board.scene,board.camera);
  const footCheck=feet.map(({i})=>{const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);const y=surface(tile.model,p.x,p.z);const a=p.clone().project(board.camera);const b=new T.Vector3(p.x,y,p.z).project(board.camera);return {position:p.toArray(),ground:y,gap:p.y-y,pixel:[(a.x+1)*640,(1-a.y)*360],groundPixel:[(b.x+1)*640,(1-b.y)*360]};});
  last={footCheck,time:t,view,groundCorrection:correction,minBootClearance:Math.min(...supports.map(s=>s.foot.y+correction-s.ground)),
   height:config.height,clip:clip.name,tile:{x:tile.x,y:tile.top,z:tile.z}};
  return last;
 }
 frame(0);
 window.__characterMotionPreview={frame,info:{clip:clip.name,duration:clip.duration,height:config.height,renderer:'Three.js r'+T.REVISION,
  effect:fireRing?.info,character:config.character,source:config.source+', clip '+config.sourceClip,ground:'Existing '+config.side+' tile; per-frame root seating only'},get last(){return last;}};
 window.__previewReady=true;
 const start=performance.now();
 function loop(now){if(!window.__captureFrames)frame((now-start)/1000,'close');requestAnimationFrame(loop);}
 requestAnimationFrame(loop);
}
main().catch(e=>{console.error(e);window.__previewError=String(e.stack||e);});

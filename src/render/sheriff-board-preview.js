import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {arenaModelNames,perimeterModelNames} from './model-assets.js';
import {loadAssets,surface} from './scene.js';
import {addPerimeter,loadGroundTexture} from './perimeter.js';
import {createMatchBoard} from './match-board.js';
import {createScheduler} from '../match/scheduler.js';
import {SHERIFF_HEIGHT,SHERIFF_YAW} from './sheriff.js';

// Isolated preview of the approved sourced clip, using the real board renderer.
// No authored motion or game rules are added here.
async function main(){
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
 renderer.setPixelRatio(1);renderer.setSize(1280,720);document.body.append(renderer.domElement);
 const input=JSON.parse(document.getElementById('preview-models').textContent);
 const [models,ground]=await Promise.all([loadAssets(input,[...arenaModelNames,...perimeterModelNames,'approved-sheriff']),loadGroundTexture()]);
 const board=await createMatchBoard({models,scheduler:createScheduler()});
 addPerimeter(board.scene,models,ground);board.resize(1280,720);
 const wide={position:board.camera.position.clone(),quaternion:board.camera.quaternion.clone()};
 const tile=board.stage.tiles[1];
 const actor=clone(models['approved-sheriff']);
 actor.scale.setScalar(SHERIFF_HEIGHT);actor.rotation.y=SHERIFF_YAW;
 actor.position.set(tile.x,tile.top,tile.z);
 let mesh;actor.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}if(o.isSkinnedMesh){mesh=o;o.frustumCulled=false;}});
 if(!mesh)throw Error('Approved Sheriff must retain its skin');
 board.scene.add(actor);
 const clip=models['approved-sheriff'].animations.find(c=>c.name==='Mixamo_walk_retargeted');
 if(!clip)throw Error('Approved walk missing');
 const mixer=new T.AnimationMixer(actor);mixer.clipAction(clip).play();
 const position=mesh.geometry.attributes.position,boots=[];
 for(let i=0;i<position.count;i++)if(position.getY(i)<.13)boots.push({i,group:(position.getX(i)<0?0:2)+(position.getZ(i)<0?0:1)});
 const point=new T.Vector3();
 let last={};
 function frame(t,view='wide'){
  mixer.setTime(t);actor.position.set(tile.x,tile.top,tile.z);actor.updateMatrixWorld(true);mesh.skeleton.update();
  const feet=Array.from({length:4},()=>({point:new T.Vector3(0,Infinity,0),i:-1}));
  for(const {i,group} of boots){
   point.fromBufferAttribute(position,i);mesh.applyBoneTransform(i,point);point.applyMatrix4(mesh.matrixWorld);
   if(point.y<feet[group].point.y){feet[group].point.copy(point);feet[group].i=i;}
  }
  const supports=feet.map(({point:p})=>({foot:p.clone(),ground:surface(tile.model,p.x,p.z)}));
  const correction=Math.max(...supports.map(s=>s.ground-s.foot.y))+.003;
  actor.position.y+=correction;actor.updateMatrixWorld(true);mesh.skeleton.update();
  if(view==='close'){
   board.closeUp('cowboy',1);board.camera.zoom=3.35;
  }else{
   board.camera.position.copy(wide.position);board.camera.quaternion.copy(wide.quaternion);board.camera.zoom=1;
  }
  board.camera.updateProjectionMatrix();board.camera.updateMatrixWorld(true);
  renderer.render(board.scene,board.camera);
  const footCheck=feet.map(({i})=>{const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);const y=surface(tile.model,p.x,p.z);const a=p.clone().project(board.camera);const b=new T.Vector3(p.x,y,p.z).project(board.camera);return {position:p.toArray(),ground:y,gap:p.y-y,pixel:[(a.x+1)*640,(1-a.y)*360],groundPixel:[(b.x+1)*640,(1-b.y)*360]};});
  last={footCheck,time:t,view,groundCorrection:correction,minBootClearance:Math.min(...supports.map(s=>s.foot.y+correction-s.ground)),
   height:SHERIFF_HEIGHT,clip:clip.name,tile:{x:tile.x,y:tile.top,z:tile.z}};
  return last;
 }
 frame(0);
 window.__approvedSheriffPreview={frame,info:{clip:clip.name,duration:clip.duration,height:SHERIFF_HEIGHT,renderer:'Three.js r'+T.REVISION,
  source:'Approved Mixamo walk, applied to user Tripo Sheriff',ground:'Existing cowboy tile; per-frame root seating only'},get last(){return last;}};
 window.__previewReady=true;
 const start=performance.now();
 function loop(now){if(!window.__captureFrames)frame((now-start)/1000,'close');requestAnimationFrame(loop);}
 requestAnimationFrame(loop);
}
main().catch(e=>{console.error(e);window.__previewError=String(e.stack||e);});

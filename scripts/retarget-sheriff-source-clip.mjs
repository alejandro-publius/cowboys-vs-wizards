// Retarget one existing Mixamo clip onto the existing Sheriff skinning rig.
// Usage: node scripts/retarget-sheriff-source-clip.mjs DIRECTORY_CONTAINING_Xbot.glb [walk|idle]
// Source and preview limits: docs/evidence/sheriff-sourced-walk-preview.md
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import './load-local.mjs';
import {rigActor} from '../src/render/rig.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=path.resolve(process.argv[2] || path.join(root,'.artifacts/sourced-sheriff'));
const motion=process.argv[3]||'walk';
if(!['walk','idle'].includes(motion))throw Error('Choose an existing walk or idle clip');
const outputName='sheriff-mixamo-'+motion+'-preview.glb';
function readGLB(p){const b=fs.readFileSync(p);let o=12,g,bin;while(o<b.length){const n=b.readUInt32LE(o),t=b.readUInt32LE(o+4);if(t===0x4e4f534a)g=JSON.parse(b.subarray(o+8,o+8+n).toString());else if(t===0x004e4942)bin=b.subarray(o+8,o+8+n);o+=n+8;}return {b,g,bin};}
async function load(p){const {b}=readGLB(p);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const sheriffPath=path.join(root,'assets/models/sheriff.glb');
const [target,source]=await Promise.all([load(sheriffPath),load(path.join(dir,'Xbot.glb'))]);
const actor=rigActor(target.scene,'sheriff',1);
actor.root.updateMatrixWorld(true);
let sourceMesh;source.scene.traverse(n=>{if(n.isSkinnedMesh&&!sourceMesh)sourceMesh=n;});
source.scene.updateMatrixWorld(true);
const sb=Object.fromEntries(sourceMesh.skeleton.bones.map(b=>[b.name.replace('mixamorig','').replace(':',''),b]));
const pairs={hips:'Hips',spine:'Spine',chest:'Spine2',head:'Head',left_shoulder:'LeftArm',left_elbow:'LeftForeArm',left_wrist:'LeftHand',right_shoulder:'RightArm',right_elbow:'RightForeArm',right_wrist:'RightHand',left_hip:'LeftUpLeg',left_knee:'LeftLeg',left_foot:'LeftFoot',right_hip:'RightUpLeg',right_knee:'RightLeg',right_foot:'RightFoot'};
const children={left_shoulder:['left_elbow','LeftForeArm'],left_elbow:['left_wrist','LeftHand'],right_shoulder:['right_elbow','RightForeArm'],right_elbow:['right_wrist','RightHand'],left_hip:['left_knee','LeftLeg'],left_knee:['left_foot','LeftFoot'],right_hip:['right_knee','RightLeg'],right_knee:['right_foot','RightFoot']};
const tb=Object.fromEntries(actor.rig.bones.map(b=>[b.name.replace('sheriff_',''),b]));
const v=()=>new T.Vector3(),q=()=>new T.Quaternion();
const rest=Object.fromEntries(Object.entries(tb).map(([name,b])=>{const s=sb[pairs[name]],sp=s.getWorldPosition(v()),tpos=b.getWorldPosition(v());let align=q();if(children[name]){const [tc,sc]=children[name];const td=tb[tc].getWorldPosition(v()).sub(tpos).normalize(),sd=sb[sc].getWorldPosition(v()).sub(sp).normalize();align.setFromUnitVectors(td,sd);}
return [name,{local:b.position.clone(),world:tpos,sq:s.getWorldQuaternion(q()),align}];}));
const sourceHip=sb.Hips.getWorldPosition(v()),scale=rest.hips.world.y/sourceHip.y;
const sourceClip=source.animations.find(a=>a.name===motion);
if(!sourceClip)throw Error('missing sourced '+motion);
const mixer=new T.AnimationMixer(source.scene);mixer.clipAction(sourceClip).play();
const samples=Math.round(sourceClip.duration*30)+1,times=new Float32Array(samples),tracks=Object.fromEntries(Object.keys(tb).map(n=>[n,new Float32Array(samples*4)])),hips=new Float32Array(samples*3);
mixer.setTime(0);source.scene.updateMatrixWorld(true);const firstHip=sb.Hips.getWorldPosition(v());
for(let f=0;f<samples;f++){const time=Math.min(sourceClip.duration-1e-6,f*sourceClip.duration/(samples-1));times[f]=f*sourceClip.duration/(samples-1);mixer.setTime(time);source.scene.updateMatrixWorld(true);
 for(const [name,b] of Object.entries(tb)){const s=sb[pairs[name]],r=rest[name];const world=s.getWorldQuaternion(q()).multiply(r.sq.clone().invert()).multiply(r.align);const parent=b.parent?.getWorldQuaternion(q())??q();b.quaternion.copy(parent.invert().multiply(world));b.position.copy(r.local);
 if(name==='hips'){const p=s.getWorldPosition(v());b.position.set(r.local.x+(p.x-firstHip.x)*scale,r.local.y+(p.y-sourceHip.y)*scale,r.local.z+(p.z-firstHip.z)*scale);b.position.toArray(hips,f*3);}
 b.updateMatrixWorld(true);b.quaternion.toArray(tracks[name],f*4);}
}
for(const [name,b] of Object.entries(tb)){b.position.copy(rest[name].local);b.quaternion.identity();}actor.root.updateMatrixWorld(true);
const original=readGLB(sheriffPath),g=structuredClone(original.g),chunks=[Buffer.from(original.bin)];let length=chunks[0].length;
function accessor(array,type,componentType,opts={}){const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),bi=g.bufferViews.length;g.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});chunks.push(bytes);length+=bytes.length;const ai=g.accessors.length;g.accessors.push({bufferView:bi,componentType,count:array.length/({SCALAR:1,VEC3:3,VEC4:4,MAT4:16}[type]),type,...opts});return ai;}
const geom=actor.body.geometry;geom.computeBoundingBox();let meshIndex;target.scene.traverse(n=>{if(n.isMesh)meshIndex=target.parser.associations.get(n)?.meshes;});meshIndex??=0;
const prim=g.meshes[meshIndex].primitives[0];
if(g.meshes[meshIndex].primitives.length!==1)throw Error('expected one sheriff primitive');
const packedPosition=new Float32Array(geom.attributes.position.count*3);for(let i=0;i<geom.attributes.position.count;i++){packedPosition[i*3]=geom.attributes.position.getX(i);packedPosition[i*3+1]=geom.attributes.position.getY(i);packedPosition[i*3+2]=geom.attributes.position.getZ(i);}
prim.attributes.POSITION=accessor(packedPosition,'VEC3',5126,{min:geom.boundingBox.min.toArray(),max:geom.boundingBox.max.toArray()});
prim.attributes.JOINTS_0=accessor(geom.attributes.skinIndex.array,'VEC4',5123);
prim.attributes.WEIGHTS_0=accessor(geom.attributes.skinWeight.array,'VEC4',5126);
g.nodes=[{name:'Sheriff sourced '+motion+' preview',mesh:meshIndex,skin:0},...actor.rig.bones.map(b=>({name:b.name,translation:b.position.toArray(),children:b.children.filter(c=>c.isBone).map(c=>actor.rig.bones.indexOf(c)+1)}))];
g.scenes=[{nodes:[0,1]}];g.scene=0;
const inverses=new Float32Array(actor.rig.bones.length*16);actor.body.skeleton.boneInverses.forEach((m,i)=>m.toArray(inverses,i*16));
g.skins=[{inverseBindMatrices:accessor(inverses,'MAT4',5126),joints:actor.rig.bones.map((_,i)=>i+1),skeleton:1}];
const ti=accessor(times,'SCALAR',5126,{min:[0],max:[times.at(-1)]}),samplers=[],channels=[];
for(const [name,b]of Object.entries(tb)){const si=samplers.length;samplers.push({input:ti,output:accessor(tracks[name],'VEC4',5126),interpolation:'LINEAR'});channels.push({sampler:si,target:{node:actor.rig.bones.indexOf(b)+1,path:'rotation'}});}
samplers.push({input:ti,output:accessor(hips,'VEC3',5126),interpolation:'LINEAR'});channels.push({sampler:samplers.length-1,target:{node:1,path:'translation'}});
g.animations=[{name:'Mixamo_'+motion+'_retargeted',samplers,channels,extras:{source:'three.js r180 Xbot.glb',sourceClip:motion,method:'source motion retargeted onto existing game rig; no hand-authored motion'}}];
g.buffers=[{byteLength:length}];g.asset.generator='Source-clip retarget preview; original Tripo Sheriff model';
let jb=Buffer.from(JSON.stringify(g));jb=Buffer.concat([jb,Buffer.alloc((4-jb.length%4)%4,32)]);let bb=Buffer.concat(chunks);bb=Buffer.concat([bb,Buffer.alloc((4-bb.length%4)%4)]);const head=Buffer.alloc(12);head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(12+8+jb.length+8+bb.length,8);const jh=Buffer.alloc(8),bh=Buffer.alloc(8);jh.writeUInt32LE(jb.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bb.length);bh.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(path.join(dir,outputName),Buffer.concat([head,jh,jb,bh,bb]));
console.log(JSON.stringify({sourceClip:sourceClip.name,duration:sourceClip.duration,samples,bones:actor.rig.bones.length,scale,output:outputName}));

// Retarget one finished library clip onto a current character skinning rig.
// Usage: node scripts/retarget-character-source-clip.mjs DIRECTORY CHARACTER SOURCE.glb CLIP
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
const kind=process.argv[3],sourceName=process.argv[4],motion=process.argv[5];
if(!['billy','wizard','skeleton'].includes(kind))throw Error('Character must be billy, wizard or skeleton');
if(!['RobotExpressive.glb','Xbot.glb','Soldier.glb','UAL1_Standard.glb'].includes(sourceName))throw Error('Known attributed source required');
const isUAL=sourceName==='UAL1_Standard.glb';
const sourceLabel=isUAL?'Quaternius Universal Animation Library Standard (CC0)':sourceName==='RobotExpressive.glb'?'Quaternius RobotExpressive (CC0)':'Mixamo '+sourceName;
const keepArmsBind=process.argv.includes('--keep-arms-bind');
const outputName=kind+'-sourced-'+motion+(keepArmsBind?'-steady-hands':'')+'-preview.glb';
function readGLB(p){const b=fs.readFileSync(p);let o=12,g,bin;while(o<b.length){const n=b.readUInt32LE(o),t=b.readUInt32LE(o+4);if(t===0x4e4f534a)g=JSON.parse(b.subarray(o+8,o+8+n).toString());else if(t===0x004e4942)bin=b.subarray(o+8,o+8+n);o+=n+8;}return {b,g,bin};}
async function load(p){const {b}=readGLB(p);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const targetPath=path.join(root,'assets/models',kind+'.glb');
const [target,source]=await Promise.all([load(targetPath),load(path.join(dir,sourceName))]);
const actor=rigActor(target.scene,kind,1);
actor.root.updateMatrixWorld(true);
let sourceMesh;source.scene.traverse(n=>{if(n.isSkinnedMesh&&!sourceMesh)sourceMesh=n;});
source.scene.updateMatrixWorld(true);
const sb=Object.fromEntries(sourceMesh.skeleton.bones.map(b=>[T.PropertyBinding.sanitizeNodeName((source.parser.json.nodes[source.parser.associations.get(b)?.nodes]?.name||b.name).replace('mixamorig','').replace(':','')),b]));
const mixamoPairs={hips:'Hips',spine:'Spine',chest:'Spine2',head:'Head',left_shoulder:'LeftArm',left_elbow:'LeftForeArm',left_wrist:'LeftHand',right_shoulder:'RightArm',right_elbow:'RightForeArm',right_wrist:'RightHand',left_hip:'LeftUpLeg',left_knee:'LeftLeg',left_foot:'LeftFoot',right_hip:'RightUpLeg',right_knee:'RightLeg',right_foot:'RightFoot'};
const robotPairs={hips:'Hips',spine:'Abdomen',chest:'Torso',head:'Head',
 left_shoulder:'UpperArm.L',left_elbow:'LowerArm.L',left_wrist:'Palm1.L',right_shoulder:'UpperArm.R',right_elbow:'LowerArm.R',right_wrist:'Palm1.R',
 left_hip:'UpperLeg.L',left_knee:'LowerLeg.L',left_foot:'Foot.L',right_hip:'UpperLeg.R',right_knee:'LowerLeg.R',right_foot:'Foot.R'};
if(kind==='billy'){robotPairs.left_wrist='Palm2.L';robotPairs.right_wrist='Palm2.R';}
const ualPairs={hips:'pelvis',spine:'spine_01',chest:'spine_03',head:'Head',left_shoulder:'upperarm_l',left_elbow:'lowerarm_l',left_wrist:'hand_l',right_shoulder:'upperarm_r',right_elbow:'lowerarm_r',right_wrist:'hand_r',left_hip:'thigh_l',left_knee:'calf_l',left_foot:'foot_l',right_hip:'thigh_r',right_knee:'calf_r',right_foot:'foot_r'};
const pairs=Object.fromEntries(Object.entries(isUAL?ualPairs:sourceName==='RobotExpressive.glb'?robotPairs:mixamoPairs).map(([k,v])=>[k,T.PropertyBinding.sanitizeNodeName(v)]));
for(const [role,name] of Object.entries(pairs))if(!sb[name])throw Error('Missing source bone '+role+': '+name+'; available='+Object.keys(sb).join(','));
const children={left_shoulder:['left_elbow','LeftForeArm'],left_elbow:['left_wrist','LeftHand'],right_shoulder:['right_elbow','RightForeArm'],right_elbow:['right_wrist','RightHand'],left_hip:['left_knee','LeftLeg'],left_knee:['left_foot','LeftFoot'],right_hip:['right_knee','RightLeg'],right_knee:['right_foot','RightFoot']};
const tb=Object.fromEntries(actor.rig.bones.map(b=>[b.name.replace(kind+'_',''),b]));
const v=()=>new T.Vector3(),q=()=>new T.Quaternion();
const rest=Object.fromEntries(Object.entries(tb).map(([name,b])=>{const s=sb[pairs[name]],sp=s.getWorldPosition(v()),tpos=b.getWorldPosition(v());let align=q();if(children[name]){const [tc]=children[name],sc=pairs[tc];const td=tb[tc].getWorldPosition(v()).sub(tpos).normalize(),sd=sb[sc].getWorldPosition(v()).sub(sp).normalize();align.setFromUnitVectors(td,sd);}
if(kind==='billy'&&(sourceName==='RobotExpressive.glb'||isUAL)&&name.endsWith('_wrist')){
 const side=actor.rig.sides[name.startsWith('left')?1:0];
 const fingertip=sb[T.PropertyBinding.sanitizeNodeName(isUAL?(name.startsWith('left')?'middle_01_l':'middle_01_r'):(name.startsWith('left')?'Middle1.L':'Middle1.R'))];
 align.setFromUnitVectors(side.palm.clone().sub(tpos).normalize(),fingertip.getWorldPosition(v()).sub(sp).normalize());
}
return [name,{local:b.position.clone(),world:tpos,sq:s.getWorldQuaternion(q()),align}];}));
const sourceHip=sb[pairs.hips].getWorldPosition(v()),scale=rest.hips.world.y/sourceHip.y;
const sourceClip=source.animations.find(a=>a.name===motion);
if(!sourceClip)throw Error('missing sourced '+motion);
const mixer=new T.AnimationMixer(source.scene);mixer.clipAction(sourceClip).play();
const samples=Math.round(sourceClip.duration*30)+1,times=new Float32Array(samples),tracks=Object.fromEntries(Object.keys(tb).map(n=>[n,new Float32Array(samples*4)])),hips=new Float32Array(samples*3);
mixer.setTime(0);source.scene.updateMatrixWorld(true);const firstHip=sb[pairs.hips].getWorldPosition(v());
for(let f=0;f<samples;f++){const time=Math.min(sourceClip.duration-1e-6,f*sourceClip.duration/(samples-1));times[f]=f*sourceClip.duration/(samples-1);mixer.setTime(time);source.scene.updateMatrixWorld(true);
 for(const [name,b] of Object.entries(tb)){const s=sb[pairs[name]],r=rest[name];const world=s.getWorldQuaternion(q()).multiply(r.sq.clone().invert()).multiply(r.align);const parent=b.parent?.getWorldQuaternion(q())??q();b.quaternion.copy(parent.invert().multiply(world));if(keepArmsBind&&/(shoulder|elbow|wrist)$/.test(name))b.quaternion.identity();b.position.copy(r.local);
 if(name==='hips'){const p=s.getWorldPosition(v());b.position.set(r.local.x+(p.x-firstHip.x)*scale,r.local.y+(p.y-sourceHip.y)*scale,r.local.z+(p.z-firstHip.z)*scale);b.position.toArray(hips,f*3);}
 b.updateMatrixWorld(true);b.quaternion.toArray(tracks[name],f*4);}
}
for(const [name,b] of Object.entries(tb)){b.position.copy(rest[name].local);b.quaternion.identity();}actor.root.updateMatrixWorld(true);
const original=readGLB(targetPath),g=structuredClone(original.g),chunks=[Buffer.from(original.bin)];let length=chunks[0].length;
function accessor(array,type,componentType,opts={}){const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),bi=g.bufferViews.length;g.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});chunks.push(bytes);length+=bytes.length;const ai=g.accessors.length;g.accessors.push({bufferView:bi,componentType,count:array.length/({SCALAR:1,VEC3:3,VEC4:4,MAT4:16}[type]),type,...opts});return ai;}
const geom=actor.body.geometry;geom.computeBoundingBox();let meshIndex;target.scene.traverse(n=>{if(n.isMesh)meshIndex=target.parser.associations.get(n)?.meshes;});meshIndex??=0;
const prim=g.meshes[meshIndex].primitives[0];
if(g.meshes[meshIndex].primitives.length!==1)throw Error('expected one character primitive');
const packedPosition=new Float32Array(geom.attributes.position.count*3);for(let i=0;i<geom.attributes.position.count;i++){packedPosition[i*3]=geom.attributes.position.getX(i);packedPosition[i*3+1]=geom.attributes.position.getY(i);packedPosition[i*3+2]=geom.attributes.position.getZ(i);}
prim.attributes.POSITION=accessor(packedPosition,'VEC3',5126,{min:geom.boundingBox.min.toArray(),max:geom.boundingBox.max.toArray()});
prim.attributes.JOINTS_0=accessor(geom.attributes.skinIndex.array,'VEC4',5123);
prim.attributes.WEIGHTS_0=accessor(geom.attributes.skinWeight.array,'VEC4',5126);
g.nodes=[{name:kind+' sourced '+motion+' preview',mesh:meshIndex,skin:0},...actor.rig.bones.map(b=>({name:b.name,translation:b.position.toArray(),children:b.children.filter(c=>c.isBone).map(c=>actor.rig.bones.indexOf(c)+1)}))];
g.scenes=[{nodes:[0,1]}];g.scene=0;
const inverses=new Float32Array(actor.rig.bones.length*16);actor.body.skeleton.boneInverses.forEach((m,i)=>m.toArray(inverses,i*16));
g.skins=[{inverseBindMatrices:accessor(inverses,'MAT4',5126),joints:actor.rig.bones.map((_,i)=>i+1),skeleton:1}];
const ti=accessor(times,'SCALAR',5126,{min:[0],max:[times.at(-1)]}),samplers=[],channels=[];
for(const [name,b]of Object.entries(tb)){const si=samplers.length;samplers.push({input:ti,output:accessor(tracks[name],'VEC4',5126),interpolation:'LINEAR'});channels.push({sampler:si,target:{node:actor.rig.bones.indexOf(b)+1,path:'rotation'}});}
samplers.push({input:ti,output:accessor(hips,'VEC3',5126),interpolation:'LINEAR'});channels.push({sampler:samplers.length-1,target:{node:1,path:'translation'}});
g.animations=[{name:sourceName.replace('.glb','')+'_'+motion+'_retargeted',samplers,channels,extras:{source:sourceLabel,sourceFile:sourceName,sourceClip:motion,character:kind,armProfile:keepArmsBind?'original Tripo arm bind; source arm channels omitted':'full source retarget',method:'source motion retargeted onto existing game rig; no hand-authored motion'}}];
g.buffers=[{byteLength:length}];g.asset.generator='Source-clip retarget preview; original Tripo '+kind+' model';
let jb=Buffer.from(JSON.stringify(g));jb=Buffer.concat([jb,Buffer.alloc((4-jb.length%4)%4,32)]);let bb=Buffer.concat(chunks);bb=Buffer.concat([bb,Buffer.alloc((4-bb.length%4)%4)]);const head=Buffer.alloc(12);head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(12+8+jb.length+8+bb.length,8);const jh=Buffer.alloc(8),bh=Buffer.alloc(8);jh.writeUInt32LE(jb.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bb.length);bh.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(path.join(dir,outputName),Buffer.concat([head,jh,jb,bh,bb]));
console.log(JSON.stringify({sourceClip:sourceClip.name,duration:sourceClip.duration,samples,bones:actor.rig.bones.length,scale,output:outputName}));

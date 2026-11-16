// Retarget existing Quaternius curves to existing game creature rigs.
// No new poses or animation curves are authored. Geometry, weights, bind pose,
// images and material bytes remain exactly those in the input game GLB.
// Usage: node scripts/retarget-creature-source-clip.mjs mounted-billy Idle_2
//        node scripts/retarget-creature-source-clip.mjs dragon Yes
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import './load-local.mjs';
globalThis.ProgressEvent??=class ProgressEvent{constructor(type,init={}){this.type=type;Object.assign(this,init);}};
const root=fileURLToPath(new URL('../',import.meta.url));
const kind=process.argv[2],motion=process.argv[3];
const definitions={
 'mounted-billy':{file:'Horse.gltf',page:'https://quaternius.com/packs/ultimateanimatedanimals.html',sourceId:'1hbtY8kxnXiPdwYGVY7rWRgU0jl_-Q-LG',
  sourceForward:['Back','Head'],targetForward:['horse_body','horse_head'],
  pairs:{horse_body:'Back',horse_neck:'Neck3',horse_head:'Head',horse_tail:'Tail3'},allowed:['Idle','Idle_2','Idle_Headlow']},
 dragon:{file:'Dragon.gltf',page:'https://quaternius.com/packs/ultimatemonsters.html',sourceId:'1-mQSm6_oGt7-EEQfNj1dFWYgPQy4AdPC',
  sourceForward:['Torso','Head'],targetForward:['chest','head'],
  pairs:{hips:'Root',chest:'Torso',neck1:'Neck',neck2:'Neck',head:'Head','wing_arm.L':'Wing1.L','wing_tip.L':'Wing3.L','wing_arm.R':'Wing1.R','wing_tip.R':'Wing3.R'},
  allowed:['Flying_Idle','No','Yes']}
};
const def=definitions[kind];assert(def&&def.allowed.includes(motion),'choose a supported existing source clip');
const directory=path.join(root,'tmp/creature-sources'),sourcePath=path.join(directory,def.file),targetPath=path.join(root,'assets/models',kind+'.glb');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function readGLB(file){const b=fs.readFileSync(file);assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(4),2);let o=12,g,bin;while(o<b.length){const n=b.readUInt32LE(o),t=b.readUInt32LE(o+4);if(t===0x4e4f534a)g=JSON.parse(b.subarray(o+8,o+8+n));else if(t===0x004e4942)bin=b.subarray(o+8,o+8+n);o+=n+8;}return {b,g,bin};}
const original=readGLB(targetPath),sourceBytes=fs.readFileSync(sourcePath);
const [target,source]=await Promise.all([
 new GLTFLoader().parseAsync(original.b.buffer.slice(original.b.byteOffset,original.b.byteOffset+original.b.byteLength),''),
 new GLTFLoader().parseAsync(sourceBytes.toString(),'')
]);
function nodesOf(gltf){const table={};gltf.scene.traverse(o=>{const node=gltf.parser.associations.get(o)?.nodes;if(node!==undefined)table[gltf.parser.json.nodes[node].name]={object:o,node};});return table;}
const tb=nodesOf(target),sb=nodesOf(source);
source.scene.updateMatrixWorld(true);target.scene.updateMatrixWorld(true);
const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
function forward(table,[a,b]){const d=table[b].object.getWorldPosition(V()).sub(table[a].object.getWorldPosition(V()));d.y=0;assert(d.length()>1e-5,'nonvertical facing vector required');return d.normalize();}
const facing=new T.Quaternion().setFromUnitVectors(forward(sb,def.sourceForward),forward(tb,def.targetForward));
function depth(o){let d=0;while(o.parent){d++;o=o.parent;}return d;}
const names=Object.keys(def.pairs).sort((a,b)=>depth(tb[a].object)-depth(tb[b].object));
const rest=Object.fromEntries(names.map(name=>{const t=tb[name].object,s=sb[def.pairs[name]].object;return [name,{target:t.getWorldQuaternion(Q()),source:s.getWorldQuaternion(Q()),local:t.quaternion.clone()}];}));
const clip=source.animations.find(c=>c.name===motion);assert(clip&&clip.validate(),'source clip exists and is valid');
const mixer=new T.AnimationMixer(source.scene);mixer.clipAction(clip).setLoop(T.LoopOnce,1).play();
const count=Math.round(clip.duration*30)+1,times=new Float32Array(count),tracks=Object.fromEntries(names.map(n=>[n,new Float32Array(count*4)]));
let mesh;target.scene.traverse(o=>{if(o.isSkinnedMesh&&!mesh)mesh=o;});assert(mesh,'target skinned mesh required');
const boxes=[],headPositions=[];
for(let f=0;f<count;f++){
 const t=clip.duration*f/(count-1);times[f]=t;mixer.setTime(Math.min(t,clip.duration-1e-7));source.scene.updateMatrixWorld(true);
 for(const name of names){
  const bone=tb[name].object,r=rest[name];
  const delta=sb[def.pairs[name]].object.getWorldQuaternion(Q()).multiply(r.source.clone().invert());
  const desired=facing.clone().multiply(delta).multiply(facing.clone().invert()).multiply(r.target);
  const parent=bone.parent.getWorldQuaternion(Q());bone.quaternion.copy(parent.invert().multiply(desired)).normalize();bone.updateMatrixWorld(true);bone.quaternion.toArray(tracks[name],f*4);
 }
 if(f%15===0||f===count-1){
  target.scene.updateMatrixWorld(true);mesh.skeleton.update();const box=new T.Box3(),pt=V();
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,pt);pt.applyMatrix4(mesh.matrixWorld);assert(pt.toArray().every(Number.isFinite),'finite skinned surface');box.expandByPoint(pt);}
  boxes.push({time:t,min:box.min.toArray(),max:box.max.toArray()});
  headPositions.push(tb[kind==='dragon'?'head':'horse_head'].object.getWorldQuaternion(Q()).toArray());
 }
}
const maxDegrees=Object.fromEntries(names.map(n=>{const a=tracks[n],q0=new T.Quaternion().fromArray(a,0);let max=0;for(let i=1;i<count;i++)max=Math.max(max,q0.angleTo(new T.Quaternion().fromArray(a,i*4))*180/Math.PI);return [n,max];}));
assert(Object.values(maxDegrees).some(x=>x>1),'source must vary a mapped joint by more than one degree');
const g=structuredClone(original.g),chunks=[Buffer.from(original.bin)];let byteLength=chunks[0].length;
function accessor(array,type,min,max){const pad=(4-byteLength%4)%4;if(pad){chunks.push(Buffer.alloc(pad));byteLength+=pad;}const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=g.bufferViews.length;g.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:bytes.length});chunks.push(bytes);byteLength+=bytes.length;const index=g.accessors.length;g.accessors.push({bufferView:view,componentType:5126,count:array.length/(type==='VEC4'?4:1),type,...(min?{min,max}:{})});return index;}
const input=accessor(times,'SCALAR',[0],[clip.duration]),samplers=[],channels=[];
for(const name of names){const index=samplers.length;samplers.push({input,output:accessor(tracks[name],'VEC4'),interpolation:'LINEAR'});channels.push({sampler:index,target:{node:tb[name].node,path:'rotation'}});}
const provenance={creator:'Quaternius',license:'CC0-1.0',sourcePage:def.page,sourceFile:def.file,sourceFileId:def.sourceId,sourceClip:clip.name,sourceSHA256:sha(sourceBytes),targetSHA256:sha(original.b),mapping:def.pairs,method:'sampled source world rotation deltas, facing-basis conversion, existing target bind pose; no authored curves',limitations:'Source translation is omitted for stationary tile playback. Unmapped joints keep their bind transforms. Mounted rider remains bound to its existing rig; source horse has no rider. Numeric checks do not prove visual quality.'};
g.animations=[{name:'Quaternius_'+kind+'_'+motion,channels,samplers,extras:provenance}];g.buffers[0].byteLength=byteLength;
g.asset.generator='Existing user Tripo mesh and target rig; Quaternius source-motion retarget';
let jb=Buffer.from(JSON.stringify(g));jb=Buffer.concat([jb,Buffer.alloc((4-jb.length%4)%4,32)]);let bb=Buffer.concat(chunks);bb=Buffer.concat([bb,Buffer.alloc((4-bb.length%4)%4)]);
const header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+jb.length+8+bb.length,8);jh.writeUInt32LE(jb.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bb.length);bh.writeUInt32LE(0x004e4942,4);
const output=path.join(directory,kind+'-quaternius-'+motion+'-preview.glb'),out=Buffer.concat([header,jh,jb,bh,bb]);fs.writeFileSync(output,out);
const reloaded=await new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');assert(reloaded.animations[0].validate(),'export roundtrip clip valid');
const report={...provenance,output,outputSHA256:sha(out),duration:clip.duration,samples:count,bonesMapped:names.length,maxDegrees,originalBinaryPreserved:bb.subarray(0,original.bin.length).equals(original.bin),originalGeometryPreserved:JSON.stringify(g.meshes)===JSON.stringify(original.g.meshes),originalBindAndWeightsPreserved:JSON.stringify(g.skins)===JSON.stringify(original.g.skins)&&JSON.stringify(g.nodes)===JSON.stringify(original.g.nodes),sampledBounds:boxes,visualReview:'pending'};
fs.writeFileSync(output.replace('.glb','.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));

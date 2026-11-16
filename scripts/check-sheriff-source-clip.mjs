// Verify the exported preview with the game's actual Three.js version.
// Does not render pixels or establish browser visual acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import './load-local.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const directory=path.resolve(process.argv[2]||path.join(root,'.artifacts/sourced-sheriff'));
const motion=process.argv[3]||'walk';
assert(['walk','idle'].includes(motion),'existing source clip required');
const bytes=fs.readFileSync(path.join(directory,'sheriff-mixamo-'+motion+'-preview.glb'));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const clip=gltf.animations.find(c=>c.name==='Mixamo_'+motion+'_retargeted');
assert(clip&&clip.validate(),'valid imported clip required');
const models=[clone(gltf.scene),clone(gltf.scene)];
const meshes=models.map(model=>{let mesh;model.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});assert(mesh,'skinned mesh required');return mesh;});
assert.notEqual(meshes[0].skeleton,meshes[1].skeleton,'independent character skeletons');
assert.notEqual(meshes[0].skeleton.bones[0],meshes[1].skeleton.bones[0],'independent bones');
const mixers=models.map(model=>new T.AnimationMixer(model));
mixers.forEach(mixer=>mixer.clipAction(clip).play());
function sample(index,time){
 mixers[index].setTime(time);
 models[index].updateMatrixWorld(true);
 const mesh=meshes[index],box=new T.Box3(),vertex=new T.Vector3();
 mesh.skeleton.update();
 for(let i=0;i<mesh.geometry.attributes.position.count;i++){
  vertex.fromBufferAttribute(mesh.geometry.attributes.position,i);
  mesh.applyBoneTransform(i,vertex);vertex.applyMatrix4(mesh.matrixWorld);
  assert(vertex.toArray().every(Number.isFinite),'finite deformed vertices');
  box.expandByPoint(vertex);
 }
 assert(box.getSize(new T.Vector3()).length()<2,'no exploded geometry');
 return {time,min:box.min.toArray(),max:box.max.toArray(),bones:mesh.skeleton.bones.map(b=>b.quaternion.toArray())};
}
const reference=sample(0,0.23);
const samples=Array.from({length:6},(_,i)=>sample(0,clip.duration*i/6));
assert.notDeepEqual(samples[0].bones,samples[2].bones,'clip must produce motion');
const otherBefore=sample(1,0.61);
sample(0,0.9);
assert.deepEqual(meshes[1].skeleton.bones.map(b=>b.quaternion.toArray()),otherBefore.bones,'one mixer must not change another troop');
const repeat=sample(0,0.23);
assert.deepEqual(repeat.bones,reference.bones,'deterministic playback');
assert.deepEqual(repeat.min,reference.min,'deterministic geometry');
const report={
 threeVersion:T.REVISION,clip:clip.name,duration:clip.duration,
 bones:meshes[0].skeleton.bones.length,vertices:meshes[0].geometry.attributes.position.count,
 embeddedImages:gltf.parser.json.images?.length??0,
 checks:['GLB import','valid animation tracks','finite deformed vertices','non-static joint transforms','independent character instances','deterministic playback'],
 observedBounds:samples.map(({time,min,max})=>({time,min,max})),
 limitation:'Programmatic Three.js verification only. Browser rendering, in-game placement, foot contact, and live-game integration remain unchecked.'
};
fs.writeFileSync(path.join(directory,'three-'+motion+'-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

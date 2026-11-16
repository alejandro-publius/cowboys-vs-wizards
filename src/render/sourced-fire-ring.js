import * as T from 'three';
import sourceFire from '../../vendor/spritefusion/fire.ts';
import {surface} from './scene.js';

// Placement/playback adapter only. Flame shapes, flicker, smoke and sparks are
// the unchanged Sprite Fusion effect, Copyright (c) 2026 Hugo Duprez, MIT.
export function addSourcedFireRing(scene,tile){
 const N=96,dt=1/60,variants=[],sprites=[];
 function variant(i){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=N;
  const ctx=canvas.getContext('2d');
  const texture=new T.CanvasTexture(canvas);
  for(const tex of [texture]){tex.colorSpace=T.SRGBColorSpace;tex.minFilter=T.LinearFilter;tex.magFilter=T.LinearFilter;tex.generateMipmaps=false;}
  const v={i,canvas,ctx,texture,frame:{w:N,h:N,ox:0,oy:0,color:new Uint32Array(N*N),light:new Uint32Array(N*N)}};
  variants.push(v);return v;
 }
 for(let i=0;i<4;i++)variant(i);
 for(let i=0;i<24;i++){
  const a=i*Math.PI*2/24,r=.95,x=tile.x+Math.cos(a)*r,z=tile.z+Math.sin(a)*r,v=variants[i%4];
  const y=surface(tile.model,x,z)+.014;
  {
   const material=new T.SpriteMaterial({map:v.texture,transparent:true,depthWrite:false,depthTest:true,toneMapped:false,blending:T.NormalBlending});
   const sprite=new T.Sprite(material);sprite.center.set(.5,1-78/96);sprite.scale.set(1.12,1.12,1);sprite.position.set(x,y,z);sprite.userData.source='Sprite Fusion fire';scene.add(sprite);sprites.push(sprite);
  }
 }
 let step=-1;
 function reset(){
  for(const v of variants){
   v.fx=sourceFire({box:[72,152,48,4],size:1.25,duration:Infinity,seed:17+v.i});
   for(let j=0;j<120+v.i*31;j++)v.fx.update(dt);
  }
  step=0;
 }
 function frame(t){
  const target=Math.max(0,Math.floor(t/dt+1e-6));if(step<0||target<step)reset();
  while(step<target){for(const v of variants)v.fx.update(dt);step++;}
  for(const v of variants){
   v.frame.color.fill(0);v.frame.light.fill(0);v.fx.draw(v.frame);
   v.ctx.putImageData(new ImageData(new Uint8ClampedArray(v.frame.color.buffer),N,N),0,0);
   v.texture.needsUpdate=true;
  }
 }
 return {frame,info:{source:'Sprite Fusion fire by Hugo Duprez (MIT)',emitters:24,sourceModified:false,dragonAnimation:false},dispose(){for(const s of sprites){scene.remove(s);s.material.dispose();}for(const v of variants){v.texture.dispose();}}};
}

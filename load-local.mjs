import {readFileSync} from "node:fs";
import {assets, loadAssets} from "./scene.js";
globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{
  const b=Buffer.from(await blob.arrayBuffer());
  if(b[0]===137)return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};
  for(let i=2;i+9<b.length;){
    if(b[i]!==255)break;
    if([192,193,194].includes(b[i+1]))
      return {width:b.readUInt16BE(i+7),height:b.readUInt16BE(i+5),close(){}};
    i+=2+b.readUInt16BE(i+2);
  }
  throw new Error("Invalid embedded texture");
};
export const localModels=()=>loadAssets(Object.fromEntries(assets.map(name=>[name,readFileSync("assets/"+name+".glb")])));

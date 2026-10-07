import fs from './resource-files.mjs';
import path from 'node:path';
import {readNativeNetwork} from '../tools/native-rig.mjs';
import {readNativeJba} from '../tools/native-jba.mjs';
const cache=new Map();
export function validateExpression(value){
 if(value==null||value==='')return null;
 if(value==='neutral')return value;
 if(typeof value!=='string'||!/^ad_face_[a-z0-9_]*pose(?:_[0-9]+)?\.jba$/.test(value))throw Error('Invalid facial expression');
 return value;
}
export async function expressionLibrary(root,directory){
 const key=path.join(root,directory);
 if(!cache.has(key))cache.set(key,(async()=>{
  const files=await fs.readdir(key),poses=files.filter(f=>/^ad_face_[a-z0-9_]*pose(?:_[0-9]+)?\.jba$/.test(f)),maps=new Map();
  if(!poses.length)return [];
  const wanted=new Set(poses);
  for(const file of files.filter(f=>f.endsWith('.mph')).sort((a,b)=>a==='anim_library.mph'?-1:b==='anim_library.mph'?1:a.localeCompare(b))){
   let network;try{network=readNativeNetwork(await fs.readFile(path.join(key,file)));}catch{continue;}
   for(const clip of network.clips)if(wanted.has(clip.name)&&!maps.has(clip.name))maps.set(clip.name,clip.bones);
   if(maps.size===poses.length)break;
  }
  const result=[];
  for(const id of poses.sort()){
   const bones=maps.get(id);if(!bones)continue;
   let motion;try{motion=readNativeJba(await fs.readFile(path.join(key,id)));}catch{continue;}
   if(motion.tracks!==bones.length)continue;
   const tracks=bones.flatMap((bone,i)=>bone.name.startsWith('fc_')?[{name:bone.name,translation:motion.motion[i].translations[0],rotation:motion.motion[i].rotations[0]}]:[]);
   if(tracks.length)result.push({id,label:id.replace('ad_face_','').replace('.jba','').replace('_pose','').replaceAll('_',' ').replace(/^./,c=>c.toUpperCase()),tracks});
  }
  return result;
 })().catch(error=>{cache.delete(key);throw error;}));
 return cache.get(key);
}

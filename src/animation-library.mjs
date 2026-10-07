import fs,{recoverSources} from './resource-files.mjs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readNativeRig,mapBmnTracks,readNativeNetwork} from '../tools/native-rig.mjs';
import {readNativeJba} from '../tools/native-jba.mjs';
const pending=new Map();
export function identifyNativeLayout(motion,candidates){
 if(candidates.length<2)return null;
 const disputed=candidates[0].bones.map((b,i)=>candidates.some(c=>c.bones[i].name!==b.name)?i:-1).filter(i=>i>=0);
 if(disputed.length<8)return null;
 const ranked=candidates.map(candidate=>{
  const score=disputed.reduce((sum,i)=>{const t=candidate.bones[i].translation,actual=motion.motion[i].translations[0];return sum+Math.min(5,Math.hypot(...t.map((v,j)=>actual[j]-v))/Math.max(1,Math.hypot(...t)));},0)/disputed.length;
  return {candidate,score};
 }).sort((a,b)=>a.score-b.score);
 // Compare only differing slots between actual native maps. Require both a
 // close bind fingerprint and a large separation; never manufacture a map.
 if(ranked[0].score>.25||ranked[1].score<5*Math.max(.001,ranked[0].score))return null;
 return {...ranked[0].candidate,association:'native map selected by bind-translation fingerprint',fingerprint:{error:ranked[0].score,alternativeError:ranked[1].score,slots:disputed.length}};
}
export function animationLibrary(root,directory){
 const key=path.join(root,directory);
 if(!pending.has(key))pending.set(key,(async()=>{
  // Native network tables reveal new clip names even when the extraction predates them.
  await recoverSources(root,[directory+'/anim_library.mph']);
  let initialFiles=await fs.readdir(key);
  const referenced=[],parsedNetworks=new Map();
  for(const file of initialFiles.filter(n=>n.endsWith('.mph'))){
    try{const network=readNativeNetwork(await fs.readFile(path.join(key,file)));parsedNetworks.set(file,network);for(const clip of network.clips)referenced.push(directory+'/'+clip.name);}catch{}
  }
  await recoverSources(root,referenced);
  const files=await fs.readdir(key),clips=files.filter(n=>n.endsWith('.jba')&&!n.startsWith('ad_')).sort(),counts=new Map(),mapping={},errors=[],layouts=new Map();
  for(let i=0;i<clips.length;i+=32)await Promise.all(clips.slice(i,i+32).map(async clip=>{
   try{
   const handle=await fs.open(path.join(key,clip),'r'),header=Buffer.alloc(52);try{await handle.read(header,0,52,0);}finally{await handle.close();}
   if(header.toString('ascii',0,4)==='JAWB'&&header.readUInt32LE(4)===2)counts.set(clip,header.readUInt32LE(48));
   }catch(error){errors.push({file:clip,error:error.message});}
  }));
  const networks=files.filter(n=>n.endsWith('.mph')).sort((a,b)=>(a==='anim_library.mph'?-1:b==='anim_library.mph'?1:a.localeCompare(b)));
  for(const file of networks){
   if(Object.keys(mapping).length===clips.length)break;
   let network;try{network=parsedNetworks.get(file)||readNativeNetwork(await fs.readFile(path.join(key,file)));}catch(e){errors.push({file,error:e.message});continue;}
   for(const clip of network.clips){
    if(!layouts.has(clip.bones.length))layouts.set(clip.bones.length,new Map());
    const signature=JSON.stringify(clip.bones.map(b=>b.name));
    if(!layouts.get(clip.bones.length).has(signature))layouts.get(clip.bones.length).set(signature,{bones:clip.bones,file,rigId:clip.rigId,mapId:clip.mapId});
    if(mapping[clip.name]||counts.get(clip.name)!==clip.bones.length)continue;
    mapping[clip.name]={bones:clip.bones,file,rigId:clip.rigId,mapId:clip.mapId};
   }
  }
  // Orphaned/rest-pose JBA files can outlive their network node. Reuse a map
  // only when every native map of that size agrees on the full ordered names.
  for(const clip of clips)if(!mapping[clip]){const candidates=layouts.get(counts.get(clip));if(candidates?.size===1)mapping[clip]={...[...candidates.values()][0],association:'unique native layout'};}
  for(const clip of clips)if(!mapping[clip]){
   const candidates=[...(layouts.get(counts.get(clip))?.values()||[])];
   if(candidates.length>1){try{const selected=identifyNativeLayout(readNativeJba(await fs.readFile(path.join(key,clip))),candidates);if(selected)mapping[clip]=selected;}catch(e){errors.push({file:clip,error:e.message});}}
  }
  const unsupported=clips.filter(c=>!mapping[c]);
  return {clips,unsupported,mapping,errors,layouts,signature:createHash('sha256').update(JSON.stringify(mapping)).digest('hex')};
 })().catch(error=>{pending.delete(key);throw error;}));
 return pending.get(key);
}
export async function decodeAssetMotion(root,directory,clip){
 const library=await animationLibrary(root,directory),mapped=library.mapping[clip];
 if(!mapped)throw Error('Unsupported or missing native asset track mapping');
 const bytes=await fs.readFile(path.join(root,directory,clip)),motion=readNativeJba(bytes);
 let bones=mapped.bones,sourceProfile=directory,sourceRig=mapped.file;
 const fingerprint=identifyNativeLayout(motion,[...(library.layouts.get(motion.tracks)?.values()||[])]);
 // Some loose JBA files supersede their network record. Override only when
 // their translations closely match another native layout (e.g. bfb's
 // dg_death_back_7: collar track differs from its bind by <0.00002 units,
 // while the recorded neck assignment differs by several units).
 if(fingerprint&&fingerprint.fingerprint.error<.03&&fingerprint.bones.some((b,i)=>b.name!==bones[i].name)){
  bones=fingerprint.bones;motion.mappingCorrection=fingerprint.fingerprint;
 }
 // Shared humanoid keys were authored against the canonical source bind.
 // The explicit native map supplies names for body-specific payloads as well.
 if((motion.tracks===102||directory.startsWith('anim/humanoid/'))&&directory!=='anim/humanoid/bmnnew'){
  let reference;try{reference=await fs.readFile(path.join(root,'anim/humanoid/bmnnew',clip));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(reference){
   const shared=readNativeJba(reference);
   if(shared.tracks===motion.tracks&&(reference.equals(bytes)||JSON.stringify(shared.motion)===JSON.stringify(motion.motion))&&(await animationLibrary(root,'anim/humanoid/bmnnew')).mapping[clip]){
    const canonical=await decodeAssetMotion(root,'anim/humanoid/bmnnew',clip);
    if(canonical.names.every((name,i)=>name===bones[i].name)){
     bones=canonical.sourceBind;sourceProfile=canonical.sourceProfile;sourceRig=canonical.sourceRig;
     motion.sharedSourceBind={reason:'identical decoded animation and ordered native bone names',tracks:motion.tracks};
    }
   }
  }
 }
 // Some body-specific clips retain a different humanoid's neutral face tracks.
 // Recognize only a complete, stationary facial pose matching a native bind;
 // never classify an animated expression as neutral from its first frame.
 if(directory.startsWith('anim/humanoid/')){
  const face=bones.flatMap((b,i)=>b.name.startsWith('fc_')&&!b.name.startsWith('fc_wrinkle')?[i]:[]);
  const error=(candidate)=>{
   let maximum=0;
   for(const i of face){
    const bind=candidate.find(b=>b.name===bones[i].name);if(!bind)return Infinity;
    for(let f=0;f<motion.frames;f++){
     const t=motion.motion[i].translations[f],q=motion.motion[i].rotations[f];
     const dot=Math.abs(q.reduce((sum,v,j)=>sum+v*bind.rotation[j],0));
     maximum=Math.max(maximum,Math.hypot(...t.map((v,j)=>v-bind.translation[j])),Math.abs(1-dot));
    }
   }
   return maximum;
  };
  if(face.length>=20&&error(bones)>.03){
   for(const profile of ['bmnnew','bfnnew']){
    let network;try{network=readNativeNetwork(await fs.readFile(path.join(root,'anim/humanoid',profile,'anim_library.mph')));}catch{continue;}
    const reference=network.clips.find(c=>c.name===clip)?.bones;
    if(reference&&error(reference)<.001){
     bones=bones.map((b,i)=>face.includes(i)?{...b,...reference.find(r=>r.name===b.name)}:b);
     motion.facialSourceBind={profile,reason:'all facial samples match native neutral bind',bones:face.length};break;
    }
   }
  }
 }
 motion.sourceBind=bones;motion.names=bones.map(b=>b.name);motion.sourceProfile=sourceProfile;motion.sourceRig=sourceRig;
 return motion;
}

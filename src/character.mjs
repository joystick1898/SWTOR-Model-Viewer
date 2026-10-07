import fs from 'node:fs/promises';
import path from 'node:path';
import {hexToHsl} from './renderer/color.mjs';

export const bodyProfiles=[...['bma','bmn','bms','bmf'],...['bfa','bfn','bfs','bfb']].map((id,i)=>({id,gender:i<4?'male':'female',bodyType:i%4+1,rig:id+'new',skeleton:`art/dynamic/spec/${id}new_skeleton.gr2`,animationDirectory:`anim/humanoid/${id}new`}));
export const appearanceDefaults={body:'bmn',head:6,hair:5,hairHue:null,eyeHue:null,skinBrightness:null,gearHue:null,hairColor:null,eyeColor:null,gearColor:null};
export function appearance(value={}){
  const a={...appearanceDefaults,...value};
  if(!bodyProfiles.some(p=>p.id===a.body))throw Error('Unsupported body profile');
  for(const key of ['head','hair'])if(!Number.isInteger(a[key])||a[key]<1||a[key]>12)throw Error('Unsupported '+key+' selection');
  for(const key of ['hairHue','eyeHue','gearHue'])if(a[key]!==null&&(typeof a[key]!=='number'||!Number.isFinite(a[key])||a[key]<0||a[key]>1))throw Error('Invalid '+key);
  for(const key of ['hairColor','eyeColor','gearColor'])if(a[key]!==null){hexToHsl(a[key]);a[key]=a[key].toUpperCase();}
  if(a.skinBrightness!==null&&(typeof a.skinBrightness!=='number'||!Number.isFinite(a.skinBrightness)||a.skinBrightness<-.3||a.skinBrightness>.5))throw Error('Invalid skin brightness');
  return Object.fromEntries(Object.keys(appearanceDefaults).map(k=>[k,a[k]]));
}
const textureProperties={DiffuseMap:'diffuseMap',RotationMap1:'rotationMap',GlossMap:'glossMap',PaletteMap:'paletteMap',PaletteMaskMap:'paletteMaskMap',DirectionMap:'directionMap',AgeMap:'ageMap',ComplexionMap:'complexionMap',FacepaintMap:'facepaintMap'};
async function material(resources,relative,template){
  const xml=await fs.readFile(path.join(resources,relative),'utf8');
  const result=structuredClone(template);result.matPath=relative;
  for(const match of xml.matchAll(/<input>([\s\S]*?)<\/input>/g)){
    const semantic=match[1].match(/<semantic>(.*?)<\/semantic>/)?.[1],value=match[1].match(/<value>(.*?)<\/value>/)?.[1];
    if(textureProperties[semantic]&&value){
      if(['AgeMap','ComplexionMap','FacepaintMap'].includes(semantic)&&result.ddsPaths[textureProperties[semantic]])continue;
      let p=value.replaceAll('\\','/')+'.dds';
      // Prefer the modernization version when supplied by this resource snapshot.
      const modern=p.replace('/___psd/','/___psd/modernization/');
      try{await fs.access(path.join(resources,modern));p=modern;}catch{}
      result.ddsPaths[textureProperties[semantic]]=p;
    }
  }
  result.otherValues.derived=xml.match(/<Derived>(.*?)<\/Derived>/)?.[1]||result.otherValues.derived;
  return result;
}
export async function assembleCharacter(resources,fixture,value){
  const a=appearance(value),profile=bodyProfiles.find(p=>p.id===a.body);
  const slots=JSON.parse(await fs.readFile(path.join(fixture,'assets/paths_corrected.json'),'utf8'));
  for(const slot of slots)slot.models=(slot.models||[]).map(p=>p.replaceAll('_bmn_',`_${a.body}_`));
  const head=slots.find(s=>s.slotName==='head'),hair=slots.find(s=>s.slotName==='hair');
  const h=String(a.head).padStart(2,'0'),style=String(a.hair).padStart(2,'0'),sex=profile.gender==='male'?'m':'f';
  head.models=[`art/dynamic/head/model/head_human_${a.body}_caucasian_a${h}.gr2`];
  if(a.body!=='bmn'||a.head!==6){
    const mat=sex==='m'?`head_human_${a.body}_caucasian_a${h}c01.mat`:`head_human_caucasian_a${h}c01_f.mat`;
    head.materialInfo=await material(resources,'art/shaders/materials/'+mat,head.materialInfo);
    if(sex==='f')for(const key of ['complexionMap','ageMap']){
      const p=head.materialInfo.ddsPaths[key]?.replace(/_m\.dds$/,'_f.dds');
      if(p){await fs.access(path.join(resources,p));head.materialInfo.ddsPaths[key]=p;}
    }
  }
  if(a.hair!==5||sex==='f'){
    const prefix=`hair_human_${a.body}_non_a${style}`;
    const files=await fs.readdir(path.join(resources,'art/dynamic/hair/model'));
    hair.models=files.filter(n=>n===prefix+'.gr2'||(n.startsWith(prefix+'_')&&n.endsWith('.gr2')&&!n.endsWith('.lod.gr2'))).sort().map(n=>'art/dynamic/hair/model/'+n);
    if(!hair.models.length)throw Error('Hair mesh unavailable for this body');
    hair.materialInfo=await material(resources,`art/shaders/materials/hair_human_non_a${style}_v01_${sex}.mat`,hair.materialInfo);
  }
  const set=(info,index,val)=>{if(val!==null)info.otherValues.palette1[index]=val;};
  set(hair.materialInfo,0,a.hairHue);set(head.materialInfo.eyeMatInfo,0,a.eyeHue);set(head.materialInfo,2,a.skinBrightness);
  const color=(info,hex)=>{if(hex!==null)info.otherValues.palette1Color=hex;};
  color(hair.materialInfo,a.hairColor);color(head.materialInfo.eyeMatInfo,a.eyeColor);
  for(const slot of slots){
    if(['chest','bracer','waist','hand','leg','boot'].includes(slot.slotName))set(slot.materialInfo,0,a.gearHue);
    if(['chest','bracer','waist','hand','leg','boot'].includes(slot.slotName))color(slot.materialInfo,a.gearColor);
    if(slot.slotName==='skinMats')for(const skin of slot.materialInfo.mats)set(skin,2,a.skinBrightness);
    for(const p of slot.models)await fs.access(path.join(resources,p.replace(/^[/\\]/,'')));
    for(const info of (slot.models.length?[slot.materialInfo,slot.materialInfo?.eyeMatInfo]:[]).filter(Boolean))
      for(const p of Object.values(info.ddsPaths||{}))await fs.access(path.join(resources,p.replace(/^[/\\]/,'')));
  }
  return {version:1,id:'human-atton-outfit',species:'human',appearance:a,profile,slots};
}

export async function designerCatalog(resources){
  return Promise.all(bodyProfiles.map(async profile=>{
    const sex=profile.gender==='male'?'m':'f',heads=[],hairs=[];
    for(let n=1;n<=12;n++){
      const num=String(n).padStart(2,'0');
      const mat=sex==='m'?`head_human_${profile.id}_caucasian_a${num}c01.mat`:`head_human_caucasian_a${num}c01_f.mat`;
      try{await Promise.all([fs.access(path.join(resources,`art/dynamic/head/model/head_human_${profile.id}_caucasian_a${num}.gr2`)),fs.access(path.join(resources,'art/shaders/materials/'+mat))]);heads.push(n);}catch{}
      try{await Promise.all([fs.access(path.join(resources,`art/dynamic/hair/model/hair_human_${profile.id}_non_a${num}.gr2`)),fs.access(path.join(resources,`art/shaders/materials/hair_human_non_a${num}_v01_${sex}.mat`))]);hairs.push(n);}catch{}
    }
    return {...profile,heads,hairs};
  }));
}


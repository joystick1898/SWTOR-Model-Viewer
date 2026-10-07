import {config,dataPath} from './runtime.mjs';
import {validateDesigner} from './designer.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {saberGroups,saberElements,elementDefaults,saberEffects} from './saber-layout.mjs';
const project=fileURLToPath(new URL('../',import.meta.url));
let pending;
async function index(){
 if(!pending)pending=(async()=>{
  const file=dataPath('equipment/catalog.json');
  try{await fs.access(file);}catch{await new Promise((resolve,reject)=>{const p=spawn(config.python,['tools/build_equipment.py'],{cwd:project,windowsHide:true});let log='';p.stdout.on('data',d=>log=(log+d).slice(-2000));p.stderr.on('data',d=>log=(log+d).slice(-2000));p.on('error',reject);p.on('close',c=>c?reject(Error(log)):resolve());});}
  return JSON.parse(await fs.readFile(file,'utf8'));
 })().catch(e=>{pending=null;throw e;});return pending;
}
export function validateBlade(b){
 if(!b||typeof b.enabled!=='boolean')throw Error('Invalid blade toggle');
 const effect=b.effect==='pulsing'?'standard':b.effect??'native';if(!saberEffects.some(([id])=>id===effect))throw Error('Invalid saber effect');
 const spacing=b.spacing??0;if(typeof spacing!=='number'||!Number.isFinite(spacing))throw Error('Invalid blade spacing');
 const result={enabled:b.enabled,effect,spacing};
 const motion=b.motion??'static';if(!['static','animated'].includes(motion))throw Error('Invalid saber motion');
 const frame=b.frame??0;if(!Number.isInteger(frame)||frame<0||frame>1023)throw Error('Invalid saber frame');
 result.motion=motion;result.frame=frame;
 const intensity=b.intensity??1.5;if(typeof intensity!=='number'||!Number.isFinite(intensity)||intensity<=0)throw Error('Invalid saber brightness');result.intensity=intensity;
 for(const [k,fallback] of [['core','#ffffff'],['glow','#4080ff']]){const v=b[k]??fallback;if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw Error('Invalid blade color');result[k]=v.toLowerCase();}
 for(const [k,fallback] of [['length',90],['width',2]]){const v=b[k]??fallback;if(typeof v!=='number'||!Number.isFinite(v)||v<=0)throw Error('Blade dimensions must be finite and greater than zero');result[k]=v;}
 if(b.layout!==undefined){
  if(!b.layout||typeof b.layout!=='object'||Array.isArray(b.layout))throw Error('Invalid saber layout');
  result.layout={};result.elements={};
  for(const [key] of saberGroups){if(typeof b.layout[key]!=='boolean')throw Error('Invalid saber layout toggle');result.layout[key]=b.layout[key];}
  result.enabled=Object.values(result.layout).some(Boolean);
  if(b.elements!==undefined&&(!b.elements||typeof b.elements!=='object'||Array.isArray(b.elements)))throw Error('Invalid saber elements');
  for(const [key] of saberElements){
   const value={...elementDefaults(result,key),...b.elements?.[key]},element={};
   for(const prop of ['position','rotation']){
    const v=value[prop];if(!Array.isArray(v)||v.length!==3||v.some(x=>typeof x!=='number'||!Number.isFinite(x)))throw Error('Invalid saber element transform');element[prop]=[...v];
   }
   for(const prop of ['length','width','intensity']){const v=value[prop];if(typeof v!=='number'||!Number.isFinite(v)||v<=0)throw Error('Invalid saber element dimension or brightness');element[prop]=v;}
   for(const prop of ['core','glow']){const v=value[prop];if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw Error('Invalid saber element color');element[prop]=v.toLowerCase();}
   result.elements[key]=element;
  }
 }
 return result;
}
export function validateEquipment(value=[]){
 if(!Array.isArray(value)||value.length>32)throw Error('Use at most 32 equipment layers');
 return value.map((r,i)=>{
  if(!r||typeof r.item!=='string'||!/^\w{24}$/.test(r.item)||typeof r.bone!=='string'||!r.bone.length||r.bone.length>120||/[\x00-\x1f]/.test(r.bone))throw Error('Invalid equipment selection');
  const vector=(v,fallback)=>{v=v??fallback;if(!Array.isArray(v)||v.length!==3||v.some(x=>typeof x!=='number'||!Number.isFinite(x)))throw Error('Invalid equipment transform');return [...v];};
  const scale=r.scale??1;if(typeof scale!=='number'||!Number.isFinite(scale)||scale<=0)throw Error('Equipment scale must be a finite number greater than zero');
  if(r.components!==undefined&&(!Array.isArray(r.components)||!r.components.length||r.components.length>128||r.components.some(p=>typeof p!=='string'||p.length>300)))throw Error('Choose at least one valid equipment component');
  if(r.replaceSlot!==undefined&&typeof r.replaceSlot!=='boolean')throw Error('Invalid clothing replacement option');
  return {...(r.blade?{blade:validateBlade(r.blade)}:{}),...(r.components?{components:[...new Set(r.components)]}:{}),...(r.replaceSlot!==undefined?{replaceSlot:r.replaceSlot}:{}),item:r.item,bone:r.bone,position:vector(r.position,[0,0,0]),rotation:vector(r.rotation,[0,0,0]),scale,...(r.colors?{colors:validateDesigner({colors:r.colors}).colors}:{})};
 });
}
export async function equipmentSearch({query='',category='',offset=0}={}){
 if(typeof query!=='string'||query.length>160||typeof category!=='string'||!Number.isInteger(offset)||offset<0)throw Error('Invalid equipment search');
 const data=await index(),words=query.toLowerCase().replaceAll('_',' ').split(/\s+/).filter(w=>w&&!['armor','set'].includes(w));
 const matches=data.items.filter(r=>(!category||r.category===category)&&words.every(w=>(r.aliases.join(' ')+' '+r.references.join(' ')).toLowerCase().replaceAll('_',' ').includes(w)));
 return {items:matches.slice(offset,offset+40).map(({id,name,category,kind,aliases,models})=>({id,name:aliases.find(a=>!a.startsWith('ipp.')&&words.every(w=>a.toLowerCase().includes(w)))||name,category,kind,aliases:aliases.slice(0,12),aliasCount:aliases.length,model:models[0],models})),total:matches.length,summary:data.summary,categories:[...new Set(data.items.map(r=>r.category))].sort()};
}
export async function resolveEquipment(value,body='bmn'){
 const selections=validateEquipment(value);if(!selections.length)return [];
 const data=await index();
 return selections.map((s,i)=>{const r=data.items.find(r=>r.id===s.item);if(!r)throw Error('Equipment appearance no longer exists in catalog');
 const substitute=p=>p.replaceAll('[bt]',body).replaceAll('[gen]',body.startsWith('bf')?'f':'m');
 if(s.components?.some(p=>!r.models.includes(p)))throw Error('Equipment component is not part of this appearance');
 return {...r,...s,...(s.colors?{colors:Object.fromEntries(Object.entries(s.colors).map(([k,v])=>[substitute(k),v]))}:{}),modelTemplates:r.models,materialInfo:r.materialByGender?.[body.startsWith('bf')?'f':'m']||r.materialInfo,layer:i,models:(s.components||r.models).map(substitute)};});
}

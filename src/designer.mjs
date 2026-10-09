import {config,dataPath} from './runtime.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {npcRecord,prepareNpc} from './npc-catalog.mjs';
import {bodyProfiles} from './character.mjs';
const project=fileURLToPath(new URL('../',import.meta.url));
const fields={asset:'4611686031694070055',mat:'4611686031694070056',attach:'4611686031694070057',p1:'4611686031694070058',p2:'4611686031694070059'};
const physical=['Head','Hair','FaceHair','SkinColor','HairColor','EyeColor','Complexion','Age','FacePaint'].map(s=>'appSlot'+s);
const canonical=e=>JSON.stringify(Object.fromEntries(Object.values(fields).filter(k=>k in e).sort().map(k=>[k,e[k]])));
const id=e=>createHash('sha256').update(canonical(e)).digest('hex').slice(0,24);
let pending;
export async function designerCatalog(){
 if(!pending)pending=(async()=>{try{return JSON.parse(await fs.readFile(dataPath('designer/catalog.json'),'utf8'));}catch{await python(['tools/build_designer.py']);return JSON.parse(await fs.readFile(dataPath('designer/catalog.json'),'utf8'));}})().catch(e=>{pending=null;throw e;});
 return pending;
}
function python(args){return new Promise((resolve,reject)=>{const child=spawn(config.python,args,{cwd:project,windowsHide:true});let log='';child.stdout.on('data',d=>log=(log+d).slice(-6000));child.stderr.on('data',d=>log=(log+d).slice(-6000));child.on('error',reject);child.on('close',c=>c?reject(Error(log)):resolve(log));});}
export function validateDesigner(d={}){
 if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Invalid designer selections');
 const body=d.body??'bmn',species=d.species??'human',sourceNpc=d.sourceNpc??null;
 if(!bodyProfiles.some(p=>p.id===body)||typeof species!=='string'||!/^[a-z_]+$/.test(species))throw Error('Invalid designer body or species');
 if(sourceNpc!==null&&(typeof sourceNpc!=='string'||!/^\d{16,20}-\d+$/.test(sourceNpc)))throw Error('Invalid source NPC');
 const choices={};for(const [slot,value] of Object.entries(d.choices||{})){if(!physical.includes(slot)||value!==null&&(typeof value!=='string'||!/^[a-f0-9]{24}$/.test(value)))throw Error('Invalid appearance choice');choices[slot]=value;}
 if(d.colors!=null&&(typeof d.colors!=='object'||Array.isArray(d.colors)))throw Error('Invalid piece colors');
 const colors={};if(Object.keys(d.colors||{}).length>256)throw Error('Too many piece colors');
 for(const [key,value] of Object.entries(d.colors||{})){
  if(key.length>300||['__proto__','constructor','prototype'].includes(key)||!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid piece color');colors[key]={};
  for(const channel of ['primary','secondary']){
   const hex=value[channel];if(hex!=null){if(typeof hex!=='string'||!/^#[a-f0-9]{6}$/i.test(hex))throw Error('Use a six-digit hex color');colors[key][channel]=hex.toUpperCase();}
   const controls=value[channel+'Palette'];
   if(controls!==undefined){
    if(!controls||typeof controls!=='object'||Array.isArray(controls))throw Error('Invalid native palette controls');
    const bounds={hue:[0,1],saturation:[0,1],brightness:[-1,1],contrast:[0,3]},clean={};
    for(const [name,n] of Object.entries(controls)){const range=Object.hasOwn(bounds,name)?bounds[name]:null;if(!range||typeof n!=='number'||!Number.isFinite(n)||n<range[0]||n>range[1])throw Error('Invalid native palette '+name);clean[name]=n;}
    if(Object.keys(clean).length)colors[key][channel+'Palette']=clean;
   }
  }
 }
 return {species,body,sourceNpc,choices,colors,useNpcAppearance:d.useNpcAppearance!==false};
}
let labelCache;
async function customizationLabels(){
 if(!labelCache)labelCache=(async()=>{const file=dataPath('designer/labels.json');try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{await python(['tools/build_designer_labels.py']);return JSON.parse(await fs.readFile(file,'utf8'));}})().catch(e=>{labelCache=null;throw e;});
 return labelCache;
}
export async function designerOptions(value={}){
 const labels=await customizationLabels();
 const d=validateDesigner(value),data=await designerCatalog(),profile=data.profiles[d.species+':'+d.body];
 if(!profile)throw Error('This species/body combination is unavailable');
 const entries={...data.entries},groups={},original={},npc=d.sourceNpc?await npcRecord(d.sourceNpc):null;
 if(npc&&!npc.nativeDefinition)throw Error('Rebuild the local NPC catalog to enable editing this appearance');
 const nativeGroups=npc?.nativeDefinition?.['4611686042464870000']||{};
 for(const [slot,values] of Object.entries(nativeGroups))if(physical.includes(slot))for(const [index,entry] of values.entries()){
  const uid=id(entry);entries[uid]??={id:uid,name:`NPC ${slot.replace('appSlot','')} ${index+1}`,entry,attachments:[]};
  if(!index)original[slot]=uid;
 }
 const sameBody=npc?.body===d.body&&d.useNpcAppearance;
 const missingChoices=Object.entries(d.choices).filter(([,uid])=>uid&&!entries[uid]).map(([slot])=>slot.replace('appSlot',''));
 const head=d.choices.appSlotHead===undefined&&sameBody?original.appSlotHead:d.choices.appSlotHead;
 groups.appSlotHead=[...profile.heads];if(sameBody&&original.appSlotHead&&!groups.appSlotHead.includes(original.appSlotHead))groups.appSlotHead.unshift(original.appSlotHead);
 const selectedHead=groups.appSlotHead.includes(head)?head:groups.appSlotHead[0];
 const rule=profile.rules[selectedHead]||Object.fromEntries(physical.filter(s=>s!=='appSlotHead').map(slot=>[slot,[...new Set(Object.values(profile.rules).flatMap(r=>r[slot]||[]))]]));
 Object.assign(groups,structuredClone(rule));
 const originalHead=sameBody&&selectedHead===original.appSlotHead;
 if(originalHead)for(const [slot,values] of Object.entries(nativeGroups))if(physical.includes(slot)&&slot!=='appSlotHead'){groups[slot]??=[];for(const entry of values){const uid=id(entry);if(!groups[slot].includes(uid))groups[slot].unshift(uid);}}
 const choices={appSlotHead:selectedHead};
 for(const [slot,ids] of Object.entries(groups)){
  if(slot==='appSlotHead')continue;
  const selected=d.choices[slot]===undefined&&originalHead?original[slot]:d.choices[slot];
  choices[slot]=selected===null?null:ids.includes(selected)?selected:ids[0]??null;
 }
 return {missingChoices,sourceName:npc?.name,designer:{...d,choices},species:data.species,profile,groups:Object.fromEntries(Object.entries(groups).map(([slot,ids])=>[slot,ids.map(uid=>({id:uid,...labels[uid],label:labels[uid]?.label||(entries[uid]?.name||uid).replaceAll('_',' '),name:entries[uid]?.name||uid,attachments:entries[uid]?.attachments||[]}))])),summary:data.summary,selectedEntries:Object.fromEntries(Object.entries(choices).map(([slot,uid])=>[slot,uid?entries[uid].entry:null]))};
}
export async function importNpcDesigner(npcId){
 const npc=await npcRecord(npcId);if(!bodyProfiles.some(p=>p.id===npc.body))throw Error('This NPC uses a creature rig. Its equipment remains editable in NPC Browser; player body customization requires a humanoid rig.');
 if(!npc.nativeDefinition?.['4611686042464870000']?.appSlotHead)throw Error('This NPC has a single custom body mesh rather than modular player appearance slots. Equipment can still be edited in NPC Browser.');
 const head=npc.slots.find(s=>s.slotName==='head');const hints=JSON.stringify(head||npc.slots).toLowerCase();
 // Material names distinguish species that share a human head mesh.
 let species=['nautolan','togruta','cathar','twilek','rattataki','miralukan','mirialan','chiss','zabrak','sith','cyborg'].find(s=>hints.includes(s))||'human';
 const options=await designerOptions({sourceNpc:npcId,species,body:npc.body});return {...options,name:npc.name};
}
export async function assembleDesigner(resources,fixture,value,optionsForAssembly){
 const options=await designerOptions(value),d=options.designer;
 if(options.missingChoices.length)throw Error('Saved appearance choices are absent from this resource snapshot: '+options.missingChoices.join(', ')+'. The preset has not been changed. Use its original resources or recreate those choices.');
 const npc=d.sourceNpc?await npcRecord(d.sourceNpc):null;
 const signature=createHash('sha256').update(JSON.stringify({revision:6,d,entries:options.selectedEntries,source:npc?.nativeDefinition})).digest('hex');
 const folder=dataPath('designer/assemblies',signature);await fs.mkdir(folder,{recursive:true});
 const output=path.join(folder,'assembly.json');
 try{await fs.access(output);}catch{
  const input=path.join(folder,'request.json');await fs.writeFile(input,JSON.stringify({designer:d,entries:options.selectedEntries,definition:npc?.nativeDefinition,fixture,output}));
  await python(['tools/assemble_designer.py',input]);
 }
 const raw=JSON.parse(await fs.readFile(output,'utf8')),assembly=await prepareNpc(resources,raw,optionsForAssembly);
 return {...assembly,appearance:{body:d.body},designer:d,designerWarnings:raw.warnings||[]};
}

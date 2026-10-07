import {config,dataPath} from './runtime.mjs';
import fs from './resource-files.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {bodyProfiles} from './character.mjs';
import {animationLibrary} from './animation-library.mjs';
const project=fileURLToPath(new URL('../',import.meta.url));
const folder=dataPath('local-npcs');
const overlay=dataPath('npc-resources');
let pending;
async function localCatalog(){
  if(!pending)pending=(async()=>{
    try{await fs.access(path.join(folder,'catalog.json'));}catch{
      await new Promise((resolve,reject)=>{
        const child=spawn(config.python,[path.join(project,'tools/build_local_npcs.py')],{cwd:project,windowsHide:true});let log='';
        child.stdout.on('data',d=>log=(log+d).slice(-3000));child.stderr.on('data',d=>log=(log+d).slice(-3000));
        child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error('Local NPC index failed: '+log)));
      });
    }
    return JSON.parse(await fs.readFile(path.join(folder,'catalog.json'),'utf8'));
  })().catch(e=>{pending=null;throw e;});
  return pending;
}
export function filterNpcs(items,query='',offset=0){
  if(typeof query!=='string'||query.length>120||!Number.isInteger(offset)||offset<0)throw Error('Invalid NPC search');
  const words=query.toLowerCase().replaceAll('_',' ').trim().split(/\s+/).filter(Boolean);
  const matches=items.filter(n=>words.every(w=>(n.name+' '+n.fqn).toLowerCase().replaceAll('_',' ').includes(w)));
  matches.sort((a,b)=>Number(b.ready)-Number(a.ready)||a.name.localeCompare(b.name)||a.fqn.localeCompare(b.fqn)||a.variant-b.variant);
  return {items:matches.slice(offset,offset+80),total:matches.length,offset,pageSize:80};
}
export async function searchNpcs(value){
  const {query='',offset=0}=typeof value==='string'?{query:value}:value||{};
  const catalog=await localCatalog();
  return {...filterNpcs(catalog.items,query,offset),indexed:catalog.items.length,summary:catalog.summary,source:'Local game files'};
}
export async function npcRecord(id){
  if(typeof id!=='string'||!/^\d{16,20}-\d+$/.test(id))throw Error('Invalid local NPC selection');
  const catalog=await localCatalog(),record=catalog.items.find(n=>n.id===id);
  if(!record)throw Error('NPC is not in the local catalog');
  if(!record.ready)throw Error(record.error||'NPC appearance is unavailable');
  const appearance=JSON.parse(await fs.readFile(path.join(folder,'appearances',record.appearanceId+'.json'),'utf8'));
  return {...appearance,...record,fqn:appearance.fqn,npcFqn:record.fqn,source:'Local game files'};
}
async function exists(root,relative){
  try{await fs.access(path.join(root,relative));}catch{await fs.access(path.join(overlay,relative));}
}
function safePath(relative){
  if(typeof relative!=='string')throw Error('Invalid NPC asset path');
  const p=relative.replaceAll('\\','/').replace(/^\/+/, '');
  if(!/^(art|anim)\//.test(p)||p.split('/').includes('..')||p.includes(':'))throw Error('NPC asset outside resources');
  return p;
}
export async function prepareNpc(root,record){
  const slots=structuredClone(record.slots),missing=[];
  async function visit(obj){
    if(!obj||typeof obj!=='object')return;
    if(obj.models)for(let i=0;i<obj.models.length;i++){
      obj.models[i]=safePath(obj.models[i]);try{await exists(root,obj.models[i]);}catch{missing.push(obj.models[i]);}
    }
    if(obj.ddsPaths)for(const [key,value] of Object.entries(obj.ddsPaths)){
      if(key==='directionMap'){delete obj.ddsPaths[key];continue;}
      const p=safePath(value);obj.ddsPaths[key]=p;
      try{await exists(root,p);}catch{missing.push(p);}
    }
    if(obj.otherValues)for(const [key,value] of Object.entries(obj.otherValues)){
      if(Array.isArray(value))obj.otherValues[key]=value.map(Number);
      else if(typeof value==='string'&&value.trim()!==''&&Number.isFinite(Number(value)))obj.otherValues[key]=Number(value);
    }
    for(const [key,value] of Object.entries(obj))if(!['ddsPaths','otherValues','models'].includes(key))await visit(value);
  }
  await visit(slots);
  if(missing.length)throw Error(`This NPC needs ${missing.length} files absent from local resources: ${missing.slice(0,3).join(', ')}`);
  let profile=record.profile||bodyProfiles.find(p=>p.id===record.body);
  if(!profile){
    if(!/^[a-z0-9_]+$/i.test(record.body))throw Error('Invalid NPC body type');
    const dat=await fs.readFile(path.join(root,`art/dynamic/spec/${record.body}.dat`),'utf8');
    const dyc=await fs.readFile(path.join(root,`art/dynamic/spec/${record.body}.dyc`),'utf8');
    profile={id:record.body,rig:record.body,skeleton:safePath('art/dynamic/spec/'+dyc.match(/^\s*Skeleton=(\S+)/m)?.[1]),animationDirectory:safePath(dat.match(/^\s*AnimNetworkFolder=(\S+)/m)?.[1]||'').replace(/\/$/,'')};
  }
  const library=await animationLibrary(root,profile.animationDirectory);
  return {version:1,id:record.id,appearance:{body:record.body},profile,slots,clips:library.clips,unsupportedClips:library.unsupported,mappingSignature:library.signature};
}

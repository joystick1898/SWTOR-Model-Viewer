import fs from 'node:fs/promises';
import path from 'node:path';

export const defaults={limitGiB:2,maxAgeDays:14,clearOnExit:false};
export function cachePolicy(value={}){
  const policy={...defaults,...value};
  if(!Number.isFinite(policy.limitGiB)||policy.limitGiB<0||policy.limitGiB>1024)throw Error('Cache limit must be between 0 and 1024 GiB.');
  if(!Number.isInteger(policy.maxAgeDays)||policy.maxAgeDays<1||policy.maxAgeDays>3650)throw Error('Cache age must be between 1 and 3650 days.');
  if(typeof policy.clearOnExit!=='boolean')throw Error('Invalid session cache setting.');
  return {limitGiB:policy.limitGiB,maxAgeDays:policy.maxAgeDays,clearOnExit:policy.clearOnExit};
}
const groups=['app-cache','asset-cache','material-cache'];
async function noLinkedAncestors(folder){
  let current=path.resolve(folder);
  while(true){const stat=await fs.lstat(current);if(stat.isSymbolicLink())throw Error('Linked cache paths are unsupported: '+current);const parent=path.dirname(current);if(parent===current)break;current=parent;}
}
async function entries(folder){return fs.readdir(folder,{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;});}
// Reject links at every level before either measuring or removing a tree.
async function measure(folder){
  const stat=await fs.lstat(folder);if(stat.isSymbolicLink())throw Error('Linked cache paths are unsupported: '+folder);
  if(!stat.isDirectory())return stat.size;
  let size=0;for(const item of await entries(folder))size+=await measure(path.join(folder,item.name));return size;
}
async function remove(root,target){
  const relative=path.relative(path.resolve(root),path.resolve(target));
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Unsafe cache cleanup path');
  let ancestor=path.resolve(root);
  for(const part of ['',...relative.split(path.sep)]){ancestor=path.join(ancestor,part);if((await fs.lstat(ancestor)).isSymbolicLink())throw Error('Linked cache paths are unsupported');}
  await measure(target);
  await fs.rm(target,{recursive:true,force:true});
}
export async function touchConversion(report){
  const now=new Date();
  await fs.utimes(path.dirname(report.file),now,now);
  // Shared materials inherit the last use of every conversion referring to them.
  for(const folder of new Set((report.textureFiles||[]).map(file=>path.dirname(file))))await fs.utimes(folder,now,now).catch(()=>{});
}
export async function storageUsage(data){
  if(!data)return {cacheBytes:0,requiredBytes:0,totalBytes:0};
  const totalBytes=await measure(data);let cacheBytes=0;
  for(const group of groups)for(const item of await entries(path.join(data,group)))cacheBytes+=await measure(path.join(data,group,item.name));
  return {cacheBytes,requiredBytes:totalBytes-cacheBytes,totalBytes};
}
// Call only while no conversion or export consumer is running. Evict whole
// conversions before collecting unreferenced shared materials.
export async function cleanCache(data,value={},clear=false,now=Date.now(),reportUsage=true){
  const policy=cachePolicy(value);await noLinkedAncestors(data);
  for(const group of groups){const folder=path.join(data,group);try{await measure(folder);}catch(error){if(error.code!=='ENOENT')throw error;}}
  const conversions=[],materials=[];
  for(const group of groups){
    for(const item of await entries(path.join(data,group))){
      const folder=path.join(data,group,item.name),stat=await fs.lstat(folder);
      if(!stat.isDirectory())continue;
      const entry={folder,bytes:await measure(folder),used:stat.mtimeMs};
      if(group==='material-cache'){materials.push(entry);continue;}
      try{entry.report=JSON.parse(await fs.readFile(path.join(folder,'result.json'),'utf8'));}catch{}
      const report=entry.report;
      let complete=report&&typeof report.file==='string'&&Array.isArray(report.textureFiles);
      if(complete)for(const file of [report.file,...report.textureFiles]){try{const s=await fs.stat(file);if(!s.isFile()||!s.size)complete=false;}catch{complete=false;}}
      if(clear||!complete||path.extname(report.file).toLowerCase()==='.fbx'||now-entry.used>policy.maxAgeDays*86400000)await remove(data,folder);
      else conversions.push(entry);
    }
  }
  const references=()=>new Set(conversions.flatMap(e=>e.report.textureFiles.map(file=>path.resolve(path.dirname(file)))));
  async function collect(){
    const referenced=references();
    for(let i=materials.length-1;i>=0;i--)if(!referenced.has(path.resolve(materials[i].folder))){await remove(data,materials[i].folder);materials.splice(i,1);}
  }
  await collect();conversions.sort((a,b)=>a.used-b.used);
  const total=()=>[...conversions,...materials].reduce((sum,e)=>sum+e.bytes,0);
  while(total()>policy.limitGiB*1024**3&&conversions.length){const oldest=conversions.shift();await remove(data,oldest.folder);await collect();}
  return reportUsage?storageUsage(data):{cacheBytes:total()};
}
export async function cleanSnapshots(root,active){
  if(path.resolve(path.dirname(active))!==path.resolve(root))throw Error('Active snapshot is outside its storage folder');
  await fs.access(path.join(active,'ready.json'));
  await noLinkedAncestors(root);
  await measure(root);
  for(const item of await entries(root)){
    if(!item.isDirectory()||! /^[a-f0-9]{16}-[a-f0-9]{8}$/.test(item.name))continue;
    const folder=path.join(root,item.name);if(path.resolve(folder)===path.resolve(active))continue;
    // Only known application snapshots; unrelated directories are never removed.
    const known=await fs.access(path.join(folder,'ready.json')).then(()=>true,()=>false)||await fs.access(path.join(folder,'failure.txt')).then(()=>true,()=>false)||await fs.access(path.join(folder,'building.json')).then(()=>true,()=>false);
    if(known)await remove(root,folder);
  }
}
export async function removeSnapshot(folder){
  if(path.basename(path.dirname(folder))!=='snapshots'||! /^[a-f0-9]{16}-[a-f0-9]{8}$/.test(path.basename(folder)))throw Error('Invalid snapshot path');
  if(!await fs.access(path.join(folder,'ready.json')).then(()=>true,()=>false))return;
  await noLinkedAncestors(folder);
  await remove(path.dirname(folder),folder);
}
export async function claimStorage(folder,home){
  await fs.mkdir(folder,{recursive:true});
  await noLinkedAncestors(folder);
  // Do not allow two independently configured viewers to share one cache.
  const file=path.join(folder,'storage-owner.json');
  try{await fs.writeFile(file,JSON.stringify({home:path.resolve(home)}),{flag:'wx'});}
  catch(error){if(error.code!=='EEXIST')throw error;const owner=JSON.parse(await fs.readFile(file,'utf8'));if(path.resolve(owner.home).toLowerCase()!==path.resolve(home).toLowerCase())throw Error('This storage folder belongs to another viewer configuration. Choose a different folder.');}
}

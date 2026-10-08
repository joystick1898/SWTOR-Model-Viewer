import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {cachePolicy,claimStorage} from './cache-policy.mjs';

export const catalogRevision=2;
export async function validateCatalogs(data){
  const read=async file=>JSON.parse(await fs.readFile(path.join(data,file),'utf8'));
  const npc=await read('local-npcs/catalog.json'),gear=await read('equipment/catalog.json'),designer=await read('designer/catalog.json'),labels=await read('designer/labels.json'),names=await read('asset-names.json');
  if(!npc.items?.some(n=>n.ready)||!gear.items?.length||!designer.profiles?.['human:bmn']||!Object.keys(labels).length||!Object.keys(names.names||{}).length)throw Error('Generated catalogs have no usable baseline content. The selected data may be incomplete or an unsupported format. Previous settings are intact.');
}
export async function readSettings(home){
  try{const data=JSON.parse(await fs.readFile(path.join(home,'settings.json'),'utf8'));if(data.version!==1)throw Error('Unsupported settings version');return data;}
  catch(e){if(e.code==='ENOENT')return null;throw Error('Settings could not be read: '+e.message);}
}
export async function writeSettings(home,value){
  await fs.mkdir(home,{recursive:true});
  const temporary=path.join(home,`settings-${randomUUID()}.tmp`);
  await fs.writeFile(temporary,JSON.stringify({...value,version:1},null,2));
  await fs.rename(temporary,path.join(home,'settings.json'));
}
export async function validateSources(value){
  const result={};
  for(const key of ['resources','game']){
    if(typeof value?.[key]!=='string'||!path.isAbsolute(value[key]))throw Error('Choose an absolute '+key+' folder.');
    result[key]=await fs.realpath(value[key]);
  }
  for(const relative of ['art/dynamic','anim','gamedata','systemgenerated/client.gom','systemgenerated/buckets','version.txt']){
    try{await fs.access(path.join(result.resources,relative));}catch{throw Error('Resources folder is missing '+relative+'. Choose the extracted resources folder.');}
  }
  const archives=await fs.readdir(path.join(result.game,'Assets')).catch(()=>[]);
  if(!archives.includes('swtor_en-us_global_1.tor')||!archives.some(n=>n.startsWith('swtor_main_')&&n.endsWith('.tor')))throw Error('Choose the SWTOR installation containing Assets and the English game archives.');
  return result;
}
// A deterministic metadata fingerprint catches additions, removals and in-place
// replacements, even when version.txt is unchanged. Explicit Rebuild also handles
// unusual extraction tools that preserve both file length and modification time.
export async function fingerprint(sources,notify=()=>{},signal){
  const hash=createHash('sha256');hash.update(JSON.stringify({revision:catalogRevision,...sources}));
  let count=0;const directories=[sources.resources,path.join(sources.game,'Assets')];
  for(let cursor=0;cursor<directories.length;cursor++){
    signal?.throwIfAborted();
    const directory=directories[cursor];
    const entries=(await fs.readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'));
    for(let offset=0;offset<entries.length;offset+=64){
      const batch=entries.slice(offset,offset+64);
      const rows=await Promise.all(batch.map(async e=>{
        const file=path.join(directory,e.name);
        if(e.isSymbolicLink())throw Error('Linked resource paths are unsupported: '+file);
        if(e.isDirectory()){directories.push(file);return null;}
        if(!e.isFile())return null;
        const stat=await fs.stat(file);return [file,stat.size,stat.mtimeMs];
      }));
      for(const row of rows)if(row){hash.update(JSON.stringify(row));count++;}
    }
    if(cursor%100===0)notify(`Checking resource changes… ${count.toLocaleString()} files`);
  }
  hash.update(await fs.readFile(path.join(sources.resources,'version.txt')));
  return {id:hash.digest('hex'),files:count};
}
export function runWorker(executable,args,{cwd,env,onProgress=()=>{},signal}){
  return new Promise((resolve,reject)=>{
    signal?.throwIfAborted();
    const child=spawn(executable,args,{cwd,env,windowsHide:true});let tail='';
    const cancel=()=>{
      if(child.pid&&child.exitCode===null){
        if(process.platform==='win32'){const killer=spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.on('error',()=>child.kill());}
        else child.kill();
      }
    };
    signal?.addEventListener('abort',cancel,{once:true});
    const capture=d=>{const text=d.toString();tail=(tail+text).slice(-12000);onProgress(text.trim().slice(-500));};
    child.stdout.on('data',capture);child.stderr.on('data',capture);
    child.on('error',reject);child.on('close',code=>{signal?.removeEventListener('abort',cancel);if(signal?.aborted)reject(Error('Setup cancelled. Previous settings are intact.'));else code===0?resolve(tail):reject(Error('Data preparation failed: '+tail.slice(-3000)));});
  });
}
export async function prepareData({home,project,runtime,sources,rebuild=false,notify=()=>{},signal,storage}){
  sources=await validateSources(sources);
  for(const key of ['python','blender','addons'])await fs.access(runtime[key]).catch(()=>{throw Error('The app runtime is missing '+key+'. Re-extract the complete application package.');});
  const before=await fingerprint(sources,notify,signal);
  const previous=await readSettings(home);
  const policy=cachePolicy(storage?.cache??previous?.cache);
  const storageHome=storage?.storageHome||previous?.storageHome||home;
  if(!path.isAbsolute(storageHome))throw Error('Choose an absolute storage folder.');
  for(const source of [sources.resources,sources.game]){
    const relative=path.relative(source,storageHome);
    if(!relative||(!relative.startsWith('..')&&!path.isAbsolute(relative)))throw Error('Generated data must be stored outside game and resource folders.');
  }
  const snapshots=path.join(storageHome,'snapshots');
  await claimStorage(storageHome,home);
  if(!rebuild&&previous?.fingerprint===before.id&&previous.data?.startsWith(snapshots+path.sep)){
    try{
      const manifest=JSON.parse(await fs.readFile(path.join(previous.data,'ready.json'),'utf8'));
      if(manifest.fingerprint===before.id&&manifest.revision===catalogRevision){
        await validateCatalogs(previous.data);
        const updated={...previous,cache:policy,storageHome};
        await writeSettings(home,updated);return updated;
      }
    }catch{}
  }
  const data=path.join(snapshots,before.id.slice(0,16)+'-'+randomUUID().slice(0,8));
  await fs.mkdir(data,{recursive:true});
  await fs.writeFile(path.join(data,'building.json'),JSON.stringify({fingerprint:before.id}));
  const env={...process.env,SWTOR_DATA:data,SWTOR_RESOURCES:sources.resources,SWTOR_GAME:sources.game,SWTOR_BLENDER:runtime.blender,SWTOR_ADDONS:runtime.addons,SWTOR_PYTHON:runtime.python,PYTHONDONTWRITEBYTECODE:'1',PYTHONUNBUFFERED:'1',PYTHONUTF8:'1'};
  const jobs=[['build_local_npcs.py','NPC appearances'],['build_equipment.py','equipment'],['build_designer.py','character choices'],['build_designer_labels.py','appearance labels'],['build_asset_names.py','search names']];
  try{
    const compatibility=await runWorker(runtime.python,[path.join(project,'tools/check_sources.py')],{cwd:project,env,signal});
    const sourceCheck=JSON.parse(compatibility.trim().split('\n').at(-1));
    sourceCheck.policy='Game database, names and art indexes are refreshed from the installation. Extracted model/texture/animation files remain primary; missing dependencies are recovered from game archives into the app cache. Unsupported records remain individually unavailable.';
    if(sourceCheck.mismatch){sourceCheck.warning='Catalogs refreshed from installed game '+sourceCheck.game.compatibleClient+' with Resources '+sourceCheck.resources.compatibleClient+'. Missing dependencies are recovered automatically. Existing extracted art remains in use until you replace the extraction.';notify('Different data versions detected. Reconciling catalogs and missing dependencies automatically…');}
    for(const [script,label] of jobs){
      notify('Building '+label+'… First setup may take several minutes.');
      const log=await runWorker(runtime.python,[path.join(project,'tools',script)],{cwd:project,env,signal,onProgress:line=>notify('Building '+label+'… '+line)});
      await fs.writeFile(path.join(data,script+'.log'),log);
    }
    await validateCatalogs(data);
    const after=await fingerprint(sources,notify,signal);
    if(after.id!==before.id)throw Error('SWTOR data changed during setup. Wait for extraction or the game update to finish, then retry. Previous settings are intact.');
    const result={version:1,...sources,data,cache:policy,storageHome,previousSnapshot:previous?.data!==data?previous?.data:previous?.previousSnapshot,fingerprint:before.id,files:before.files,preparedAt:new Date().toISOString(),sourceCheck};
    await fs.writeFile(path.join(data,'ready.json'),JSON.stringify({revision:catalogRevision,fingerprint:before.id}));
    await fs.unlink(path.join(data,'building.json'));
    await writeSettings(home,result);return result;
  }catch(error){await fs.writeFile(path.join(data,'failure.txt'),error.stack||error.message);throw error;}
}

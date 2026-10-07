// Read a resource snapshot plus dependencies recovered into its private cache.
// Existing extracted art is authoritative; installed-game indexes are explicitly
// refreshed by the catalog builder and take precedence for metadata only.
import fs from 'node:fs/promises';
import sync from 'node:fs';
import path from 'node:path';
import {config,dataPath,project} from './runtime.mjs';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';

function overlayFor(file){
  if(typeof file!=='string'||!config.resources)return null;
  const relative=path.relative(path.resolve(config.resources),path.resolve(file));
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative))return null;
  return dataPath('npc-resources',relative);
}
export function resolvedResource(file){
  const overlay=overlayFor(file);
  if(overlay&&sync.existsSync(overlay)&&(!sync.existsSync(file)||/[/\\]index\.xml$/i.test(file)))return overlay;
  return file;
}
async function readdir(file,options){
  const overlay=overlayFor(file);
  if(!overlay||!sync.existsSync(overlay))return fs.readdir(file,options);
  const original=await fs.readdir(file,options).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
  const recovered=await fs.readdir(overlay,options);
  const key=e=>typeof e==='string'?e:e.name;
  return [...new Map([...original,...recovered].map(e=>[key(e),e])).values()];
}
export default {...fs,readdir,
  readFile:(file,...args)=>fs.readFile(resolvedResource(file),...args),
  access:(file,...args)=>fs.access(resolvedResource(file),...args),
  stat:(file,...args)=>fs.stat(resolvedResource(file),...args),
  open:(file,...args)=>fs.open(resolvedResource(file),...args),
};
export async function recoverSources(root,relativePaths){
  if(!config.game||!config.python||path.resolve(root)!==path.resolve(config.resources))return;
  const missing=[...new Set(relativePaths)].filter(relative=>{
    if(typeof relative!=='string'||! /^(art|anim)\//.test(relative)||relative.split('/').includes('..')||relative.includes(':'))throw Error('Invalid recovered resource path');
    return !sync.existsSync(resolvedResource(path.join(root,relative)));
  });
  if(!missing.length)return;
  const request=dataPath('recovery-'+randomUUID()+'.json');await fs.mkdir(path.dirname(request),{recursive:true});await fs.writeFile(request,JSON.stringify(missing));
  try{
    await new Promise((resolve,reject)=>{
      const child=spawn(config.python,[path.join(project,'tools/recover_sources.py'),request],{cwd:project,windowsHide:true});let log='';
      child.stdout.resume();child.stderr.on('data',d=>log=(log+d).slice(-4000));child.on('error',reject);child.on('close',code=>code?reject(Error('Resource recovery failed: '+log)):resolve());
    });
  }finally{await fs.unlink(request).catch(()=>{});}
}

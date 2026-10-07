import fs from './resource-files.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assetNames,nameAsset,filterAssets} from './asset-names.mjs';
let pending;
import {dataPath} from './runtime.mjs';
const cache=dataPath('asset-index.json');
async function modelFiles(resources){
  const version=await fs.readFile(path.join(resources,'version.txt'),'utf8');
  try{const data=JSON.parse(await fs.readFile(cache,'utf8'));if(data.resources===resources&&data.version===version)return data.files;}catch{}
  const root=path.join(resources,'art'),directories=[''],files=[];
  for(let cursor=0;cursor<directories.length;){
    const batch=directories.slice(cursor,cursor+32);cursor+=batch.length;
    const entries=await Promise.all(batch.map(async directory=>({directory,entries:await fs.readdir(path.join(root,directory),{withFileTypes:true})})));
    for(const {directory,entries:children} of entries)for(const child of children){const relative=path.join(directory,child.name);if(child.isDirectory())directories.push(relative);else if(child.isFile()&&child.name.endsWith('.gr2')&&!child.name.endsWith('.lod.gr2'))files.push(relative);}
  }
  await fs.mkdir(path.dirname(cache),{recursive:true});await fs.writeFile(cache,JSON.stringify({resources,version,files}));return files;
}
export function assetIndex(resources){
  return pending??=Promise.all([modelFiles(resources),assetNames()]).then(([files,names])=>files.map(p=>{
    const id='art/'+p.replaceAll('\\','/'),name=path.basename(p,'.gr2');
    const body=name.match(/_(bma|bmn|bms|bmf|bfa|bfn|bfs|bfb)_/)?.[1]||null;
    const segments=id.split('/');return {id,name,category:segments[1]==='dynamic'?segments[2]:segments[1],body};
  }).map(a=>nameAsset(a,names)).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id))).catch(error=>{pending=null;throw error;});
}
export async function searchAssets(resources,{query='',category='',offset=0}={}){
  if(typeof query!=='string'||query.length>200||typeof category!=='string'||!Number.isSafeInteger(offset)||offset<0)throw Error('Invalid asset search');
  return filterAssets(await assetIndex(resources),{query,category,offset});
}

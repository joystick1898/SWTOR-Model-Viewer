import {config,dataPath} from './runtime.mjs';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
let pending;
export function assetNames(){
  return pending??=(async()=>{
    const sources=['equipment/catalog.json','local-npcs/catalog.json'];
    const stamps=Object.fromEntries(await Promise.all(sources.map(async s=>[s,Math.floor((await fs.stat(dataPath(s))).mtimeMs)])));
    const file=dataPath('asset-names.json');
    try{const data=JSON.parse(await fs.readFile(file,'utf8'));if(data.version===1&&sources.every(s=>data.sources[s]===stamps[s]))return data.names;}catch{}
    await new Promise((resolve,reject)=>{
      const child=spawn(config.python,['tools/build_asset_names.py'],{cwd:root,windowsHide:true});let log='';
      child.stderr.on('data',d=>log=(log+d).slice(-2000));child.stdout.resume();
      child.on('error',reject);child.on('close',code=>code?reject(Error(log||'Asset name index failed')):resolve());
    });
    return JSON.parse(await fs.readFile(file,'utf8')).names;
  })().catch(error=>{pending=null;throw error;});
}
export function nameAsset(asset,names){
  const aliases=names[asset.id.toLowerCase()]||[];
  return {...asset,fileName:asset.name,name:aliases[0]||asset.name,aliases};
}
export function filterAssets(all,{query='',category='',offset=0}={}){
  const q=query.toLowerCase().trim();
  const matched=all.filter(a=>(!category||a.category===category)&&(!q||[a.id,a.name,...a.aliases].some(n=>n.toLowerCase().includes(q))));
  return {total:matched.length,indexed:all.length,categories:[...new Set(all.map(a=>a.category))].sort(),items:matched.slice(offset,offset+80).map(a=>({...a,name:a.aliases.find(n=>q&&n.toLowerCase().includes(q))||a.name}))};
}

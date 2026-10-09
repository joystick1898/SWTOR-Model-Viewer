import fs from 'node:fs/promises';
import path from 'node:path';
import {exportZGCharacter,defaultState,equipment,npcs} from '../src/backend.mjs';
import {writeZGPackage} from '../src/zg-export.mjs';

const root=path.resolve('output/zg-integration/run-'+Date.now());
await fs.mkdir(root,{recursive:true});
const jacket=(await equipment({query:"Atton Rand's Jacket"})).items.find(e=>e.category==='chest');
if(!jacket)throw Error('Atton jacket fixture missing');
const cases=[{name:'atton-dyed',request:{kind:'designer',state:{...defaultState,appearance:{...defaultState.appearance,hairColor:'#482D18',eyeColor:'#4080C0',gearColor:'#8040C0'}}}}];
for(const body of ['bma','bmn','bms','bmf','bfa','bfn','bfs','bfb'])cases.push({name:'native-'+body,request:{kind:'designer',state:{...defaultState,version:2,character:'native-designer',clip:null,designer:{species:'human',body,choices:{},colors:{skin:{primary:'#D0A080'},eyes:{primary:'#4080C0'},hair:{primary:'#482D18'}}},equipment:body==='bmn'?[{item:jacket.id,bone:'@skin',colors:{'*':{primary:'#8040C0',secondary:'#20A060'}}}]:[]}}});
const npc=(await npcs({query:'Atton'})).items.find(n=>n.ready);
if(npc)cases.push({name:'npc-atton',request:{kind:'npc',id:npc.id,selection:{}}});
const results=[];
for(const {name,request} of cases){
  try{
    const result=await exportZGCharacter(request);
    const saved=await writeZGPackage(result,path.join(root,name));
    results.push({name,ok:true,...saved});console.log('ZG_EXPORT_PASS',name);
  }catch(e){results.push({name,ok:false,error:e.message});console.log('ZG_EXPORT_FAIL',name,e.message);}
}
await fs.writeFile('reports/zg-export-smoke.json',JSON.stringify({root,results},null,2));
if(results.some(r=>!r.ok))process.exitCode=1;

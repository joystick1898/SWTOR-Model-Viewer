import fs from 'node:fs/promises';
import {convert,convertNpc,convertAsset,defaultState} from '../src/backend.mjs';
const c=JSON.parse(await fs.readFile('output/equipment/catalog.json','utf8'));
const armor=c.items.find(r=>r.references.includes('ipp.mtx.season2.kotor.darth_malak.chest'));
const s=JSON.parse(await fs.readFile('reports/equipment-pipeline-smoke.json','utf8')).state.equipment;
const results=[];
for(const body of ['bma','bmn','bms','bmf','bfa','bfn','bfs','bfb']){
 try{const r=await convert({...defaultState,appearance:{...defaultState.appearance,body},equipment:[...s,{item:armor.id,bone:'@skin'}]});if(r.parts.filter(p=>p.equipmentItem).length!==6)throw Error('Expected 3 attachments + 3 clothing meshes');results.push({body,ok:true,parts:r.parts.length});console.log('PASS',body);}
 catch(e){results.push({body,ok:false,error:e.message});console.log('FAIL',body,e.message);}
}
try{const npc=await convertNpc('16141165779735661825-0',{equipment:s});results.push({npc:'Aric Jorgan',ok:npc.equipment.length===3,parts:npc.parts.length});}catch(e){results.push({npc:'Aric Jorgan',ok:false,error:e.message});}
try{
 const id='art/dynamic/creature/model/atst_walker_baron01.gr2';const base=await convertAsset(id);const target=base.bones.find(b=>/head/i.test(b))||base.bones[0];
 const r=await convertAsset(id,{equipment:[{...s[2],bone:target,position:[10,0,0],rotation:[0,45,0],scale:.7}]});results.push({asset:id,target,ok:r.equipment.length===1,parts:r.parts.length});
}catch(e){results.push({asset:'walker',ok:false,error:e.message});}
await fs.writeFile('reports/equipment-compatibility-smoke.json',JSON.stringify({ok:results.every(r=>r.ok),results},null,2));if(results.some(r=>!r.ok))process.exitCode=1;

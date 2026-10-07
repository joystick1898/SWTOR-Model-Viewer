import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {convert,convertNpc,defaultState} from '../src/backend.mjs';
import {writeExportBundle} from '../src/export-bundle.mjs';
const c=JSON.parse(await fs.readFile('output/equipment/catalog.json','utf8'));
const results=[];
for(const [name,count] of [['saber_gs07_a01_v01',2],['dualsaber_gs07_a01_v01',4],['saber_mtx06_a01_v01',6],['dualsaber_mtx06_a01_v01',12],['saber_mtx11_a01_v01',4],['dualsaber_high12_a01_v02',4],['saber_sithlow03_a01',2]]){
 const item=c.items.find(r=>r.models.some(m=>m.endsWith('/'+name+'.gr2')));
 const state={...defaultState,clip:'cb_warrior_saber_idle_1.jba',weapon:'none',equipment:[{item:item.id,bone:'RightWeapon',scale:1,position:[0,0,0],rotation:[0,0,0],blade:{enabled:true,core:'#ffffff',glow:'#00aaff',length:90,width:2}}]};
 const preview=await convert(state);assert.equal(preview.parts.filter(p=>p.name.includes('_blade_')).length,count);
 const exported=await convert({...state,time:.2},'fbx');const destination=path.resolve('output',name+'-blade.fbx');await writeExportBundle(exported,state,destination);
 results.push({id:name,ok:true,exported:{...exported,state},destination});await fs.writeFile('reports/saber-pipeline-smoke.json',JSON.stringify({ok:true,results},null,2));console.log('PASS',name);
}



const item=c.items.find(r=>r.models.some(m=>m.endsWith('/saber_gs07_a01_v01.gr2')));
const equipment=['RightWeapon','socket_saber_left'].map((bone,i)=>({item:item.id,bone,position:[0,0,0],rotation:[0,0,0],scale:1,blade:{enabled:i===0,core:'#ffdd88',glow:'#ff3300',length:65,width:3.5}}));
const selection={equipment};const preview=await convertNpc('16141108995265840656-0',selection);assert.equal(preview.parts.filter(p=>p.name.includes('_blade_')).length,2);
const exported=await convertNpc('16141108995265840656-0',selection,'fbx'),destination=path.resolve('output/npc-saber-blade.fbx');await writeExportBundle(exported,selection,destination);results.push({id:'npc-saber',ok:true,exported,destination});await fs.writeFile('reports/saber-pipeline-smoke.json',JSON.stringify({ok:true,results},null,2));console.log('PASS NPC independent on/off layers');

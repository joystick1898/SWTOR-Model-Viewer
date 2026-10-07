import fs from 'node:fs/promises';import {convert,defaultState} from '../src/backend.mjs';
const catalog=JSON.parse(await fs.readFile('output/equipment/catalog.json','utf8')),results=[];
for(const name of ['dualsaber_sithlow03_a01','dualsaber_jedihigh01_a01_v01']){
 const item=catalog.items.find(i=>i.models.some(m=>m.endsWith('/'+name+'.gr2')));
 const state={...defaultState,clip:'cb_warrior_saber_idle_1.jba',equipment:[{item:item.id,bone:'RightWeapon',position:[0,0,0],rotation:[0,0,0],scale:1,blade:{enabled:true,core:'#ffffff',glow:'#4080ff',length:90,width:2}}]};
 const preview=await convert(state);const exported=await convert(state,'fbx');
 results.push({id:name,ok:true,preview,exported:{...exported,state},destination:exported.file});console.log('PASS',name);
}
await fs.writeFile('reports/blade-alignment-smoke.json',JSON.stringify({ok:true,results},null,2));

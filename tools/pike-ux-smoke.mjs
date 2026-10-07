import fs from 'node:fs/promises';import {convert,defaultState,designerOptions} from '../src/backend.mjs';
const catalog=JSON.parse(await fs.readFile('output/equipment/catalog.json','utf8')),results=[];
for(const [id,query,spacing] of [['senya-pike','Senya\'s Lightsaber Pike',0],['dual-spacing','polesaber 2',-4]]){
 const item=catalog.items.find(i=>i.aliases.includes(query));if(!item)throw Error(query);
 const options=await designerOptions({species:'human',body:'bmn'});
 const state={...defaultState,version:2,character:'native-designer',designer:options.designer,clip:'cb_warrior_saber_idle_1.jba',equipment:[{item:item.id,bone:'RightWeapon',position:[0,0,0],rotation:[0,0,0],scale:1,blade:{enabled:true,core:'#ffffff',glow:'#4080ff',length:90,width:2,spacing}}]};
 const preview=await convert(state);const exported=await convert(state,'fbx');
 if(id==='senya-pike'&&!preview.parts.some(p=>p.source.includes('extendshaft')))throw Error('Missing shaft');
 results.push({id,ok:true,preview,exported:{...exported,state},destination:exported.file});console.log('PASS',id);
}
await fs.writeFile('reports/pike-ux-smoke.json',JSON.stringify({ok:true,results},null,2));

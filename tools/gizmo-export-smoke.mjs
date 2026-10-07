import fs from 'node:fs/promises';
import {convertNpc} from '../src/backend.mjs';
import {writeExportBundle} from '../src/export-bundle.mjs';
const smoke=JSON.parse(await fs.readFile('reports/equipment-gizmo-smoke.json','utf8'));if(!smoke.ok)throw Error('Run successful gizmo UI test first');
const results=[];
for(const [name,equipment] of [['automatic',smoke.adjustedEquipment.map(e=>({...e,position:[0,0,0],rotation:[0,0,0],scale:1}))],['adjusted',smoke.adjustedEquipment]]){
 const selection={clip:smoke.clip,time:.48,equipment};const exported=await convertNpc(smoke.npc,selection,'fbx');
 const destination=process.cwd()+'/output/Kira-prone-rifle-'+name+'.fbx';await writeExportBundle(exported,{npc:smoke.npc,...selection},destination);results.push({id:name,ok:true,exported,destination});
}
await fs.writeFile('reports/equipment-gizmo-pipeline.json',JSON.stringify({ok:true,results},null,2));console.log('GIZMO_EXPORT_PASS',results.length);

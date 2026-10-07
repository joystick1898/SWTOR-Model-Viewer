import fs from 'node:fs/promises';
import path from 'node:path';
import {convertNpc} from '../src/backend.mjs';
import {writeExportBundle} from '../src/export-bundle.mjs';
globalThis.fetch=()=>{throw Error('Network access forbidden in offline NPC verification');};
const catalog=JSON.parse(await fs.readFile('output/local-npcs/catalog.json','utf8'));
const seen=new Set(),selected=[];
for(const r of catalog.items)if(r.ready&&/^(Darth Malgus|Shade of Malgus)$/.test(r.name)&&!seen.has(r.appearanceId)){seen.add(r.appearanceId);selected.push(r);}
for(const fqn of ['npc.exp.seasons.01.ep_11.quest.aric_sc7','npc.event.pirate_onslaught.event_off.republic.farmer_01']){const r=catalog.items.find(r=>r.ready&&r.fqn===fqn);if(r)selected.push(r);}
for(const name of ['Ancient Swamp Rancor','Alliance Trooper','Republic Trooper']){const r=catalog.items.find(r=>r.ready&&r.name===name);if(r)selected.push(r);}
console.log('Offline fixtures',selected.length);const results=[];
for(const record of selected){
 try{
  const preview=await convertNpc(record.id,{});
  const exported=await convertNpc(record.id,{clip:preview.clip,time:preview.duration*.4},'fbx');
  const destination=path.resolve('output/offline-npc-examples/'+record.name.replaceAll(' ','-')+'-'+record.id+'.fbx');
  await writeExportBundle(exported,{npc:record.id,clip:preview.clip},destination);
  results.push({id:record.id,name:record.name,fqn:record.fqn,ok:true,exported,destination});console.log('PASS',record.name,record.id,exported.parts.length);
 }catch(e){results.push({id:record.id,name:record.name,fqn:record.fqn,ok:false,error:e.message});console.log('FAIL',record.name,e.message);}
 await fs.writeFile('reports/local-npc-pipeline-smoke.json',JSON.stringify({ok:results.every(r=>r.ok),networkDisabled:true,results},null,2));
}

if(results.some(r=>!r.ok))process.exitCode=1;

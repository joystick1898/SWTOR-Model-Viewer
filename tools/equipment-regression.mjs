// Exercise every affected item/body through the production resolver, then let
// Blender validate every distinct surviving mesh against its target skeleton.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const settings=JSON.parse(await fs.readFile(path.join(process.env.APPDATA,'SWTOR Model Viewer/settings.json'),'utf8'));
for(const key of ['resources','game','data'])process.env['SWTOR_'+key.toUpperCase()]=settings[key];
const {config}=await import('../src/runtime.mjs');
const {resolveEquipment,equipmentSearch}=await import('../src/equipment.mjs');
const {equipmentBodies}=await import('../src/equipment-resources.mjs');
const audit=JSON.parse(await fs.readFile('reports/equipment-resource-audit.json','utf8'));
const catalog=JSON.parse(await fs.readFile(path.join(settings.data,'equipment/catalog.json'),'utf8'));
const items=catalog.items.filter(e=>audit.affected.some(a=>a.id===e.id));
const outcomes=[],batches=[];
for(const body of equipmentBodies){
 const usable=[];
 for(const item of items){
  const missing=audit.affected.find(a=>a.id===item.id).missing.filter(m=>m.body===body);
  if(missing.some(m=>m.role==='base')){
   await assert.rejects(resolveEquipment([{item:item.id,bone:'@skin'}],body),/unavailable for body/);
   outcomes.push({id:item.id,name:item.name,body,status:'unavailable'});
  }else usable.push(item);
 }
 const entries=[];
 for(let i=0;i<usable.length;i+=32){
  const resolved=await resolveEquipment(usable.slice(i,i+32).map(e=>({item:e.id,bone:'@skin'})),body);
  entries.push(...resolved);
  for(const e of resolved)outcomes.push({id:e.id,name:e.name,body,status:e.warnings.some(w=>w.includes('appearance may be incomplete'))?'partial':'available',warnings:e.warnings,models:e.models});
 }
 batches.push({body,models:[...new Set(entries.flatMap(e=>e.models))]});
 console.log(body,entries.length,'loadable appearances');
}
for(const [query,body,status] of [['RF-10 Cybernetic Adapter','bmn','unavailable'],["Republic Dancer's Top",'bmn','unavailable'],["Republic Dancer's Top",'bfn','available'],['Reforged Havoc Squad Helmet','bmn','partial']]){
 const result=await equipmentSearch({query,body});assert.ok(result.items.length);
 assert.equal(result.items.find(e=>e.name===query)?.availability.status,status,query+' '+body);
}
const report={summary:{combinations:outcomes.length,available:outcomes.filter(e=>e.status==='available').length,partial:outcomes.filter(e=>e.status==='partial').length,unavailable:outcomes.filter(e=>e.status==='unavailable').length},outcomes};
await fs.writeFile('reports/equipment-regression.json',JSON.stringify(report,null,2));
if(process.argv.includes('--blender')){
 const request=path.resolve('reports/equipment-mesh-request.json');
 await fs.writeFile(request,JSON.stringify({resources:config.resources,addons:config.addons,batches,output:path.resolve('reports/equipment-mesh-regression.json')}));
 const log=await fs.open('reports/equipment-mesh-regression.log','w');
 try{await new Promise((resolve,reject)=>{
  const child=spawn(config.blender,['--background','--factory-startup','--disable-autoexec','--python-exit-code','1','--python','tools/verify-equipment-models.py','--',request],{windowsHide:true,stdio:['ignore',log.fd,log.fd]});
  child.on('error',reject);child.on('close',code=>code?reject(Error('Mesh verification failed; see reports/equipment-mesh-regression.log')):resolve());
 });}finally{await log.close();}
 const result=JSON.parse(await fs.readFile('reports/equipment-mesh-regression.json','utf8'));console.log(result.summary);assert.equal(result.summary.failed,0);
}
console.log(report.summary);

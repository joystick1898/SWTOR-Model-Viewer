import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const settings=JSON.parse(await fs.readFile(path.join(process.env.APPDATA,'SWTOR Model Viewer/settings.json'),'utf8'));
for(const key of ['resources','game','data'])process.env['SWTOR_'+key.toUpperCase()]=settings[key];
const {resolveEquipment}=await import('../src/equipment.mjs');
const catalog=JSON.parse(await fs.readFile(path.join(settings.data,'equipment/catalog.json'),'utf8'));
const items=catalog.items.filter(e=>e.aliases.some(a=>a.startsWith('Reforged Havoc Squad')));
assert.equal(items.length,8);
for(const body of ['bma','bmn','bms','bmf','bfa','bfn','bfs','bfb']){
 const entries=await resolveEquipment(items.map(e=>({item:e.id,bone:'@skin'})),body);
 console.log(body,entries.map(e=>({name:e.name,models:e.models.length,warnings:e.warnings})));
 assert.equal(entries.find(e=>e.slot==='face').models.length,1);
 assert.ok(entries.every(e=>e.models.length));
}
if(process.argv.includes('--convert')){
 const folders=await fs.readdir(path.join(settings.data,'app-cache'));
 let request;
 for(const folder of folders){
  const dir=path.join(settings.data,'app-cache',folder);
  const files=await fs.readdir(dir).catch(()=>[]);
  const file=files.find(f=>f.startsWith('request-')&&f.endsWith('.json'));
  if(file){request=JSON.parse(await fs.readFile(path.join(dir,file),'utf8'));if(request.state?.version===2)break;}
 }
 assert.equal(request?.state?.version,2);
 const {convert}=await import('../src/backend.mjs');
 const equipment=items.filter(e=>!e.name.endsWith('with Backpack')).map(e=>({item:e.id,bone:'@skin'}));
 const result=await convert({...request.state,equipment},'preview',console.log);
 for(const e of equipment)assert.ok(result.parts.some(p=>p.equipmentItem===e.item),e.item);
 console.log('FULL OUTFIT PREVIEW PASS',result.file,result.equipmentWarnings);
}

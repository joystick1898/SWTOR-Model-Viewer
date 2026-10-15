import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const settings=JSON.parse(await fs.readFile(path.join(process.env.APPDATA,'SWTOR Model Viewer/settings.json'),'utf8'));
for(const key of ['resources','game','data'])process.env['SWTOR_'+key.toUpperCase()]=settings[key];
const {convert,defaultState}=await import('../src/backend.mjs');
const {designerOptions}=await import('../src/designer.mjs');
const catalog=JSON.parse(await fs.readFile(path.join(settings.data,'equipment/catalog.json'),'utf8'));
const cases=[
 {body:'bmn',names:['High Roller Helmet','B-400 Cybernetic Breastplate','B-400 Cybernetic Boots','B-400 Cybernetic Gauntlets',"Senya's Belt"]},
 {body:'bfs',names:["Hidden Chain's Helmet","Keeper of Iokath's Breastplate",'Rugged Infantry Belt',"Reclusive Master's Boots"]},
 {body:'bma',names:["Vengeance's Vendetta", "Republic Dancer's Gloves"]},
 {body:'bmf',names:["Relic Plunderer's Helmet"]},
 {body:'bfn',names:["Republic Dancer's Top","Republic Dancer's Shoes"]},
];
const results=[];
for(const entry of cases){
 const {designer}=await designerOptions({species:'human',body:entry.body});
 const equipment=entry.names.map(name=>{const item=catalog.items.find(e=>e.name===name);assert.ok(item,name);return {item:item.id,bone:'@skin'};});
 const state={...defaultState,version:2,character:'native-designer',designer,appearance:{body:entry.body},clip:null,equipment};
 for(const mode of entry.body==='bma'?['preview','fbx']:['preview']){
  console.log('CONVERT',entry.body,mode,entry.names);
  const result=await convert(state,mode,console.log);
  for(const item of equipment)assert.ok(result.parts.some(p=>p.equipmentItem===item.item),item.item);
  assert.ok((await fs.stat(result.file)).size>0);
  for(const texture of result.textureFiles)assert.ok((await fs.stat(texture)).size>0);
  results.push({...entry,mode,ok:true,file:result.file,parts:result.parts.length,warnings:result.equipmentWarnings,textures:result.textureFiles.length});
  await fs.writeFile('reports/equipment-material-regression.json',JSON.stringify({ok:true,results},null,2));
 }
}
console.log('MATERIAL AND EXPORT REGRESSION PASS',results.length);

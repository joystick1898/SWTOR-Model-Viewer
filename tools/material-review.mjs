import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {convert,defaultState} from '../src/backend.mjs';
import {writeExportBundle} from '../src/export-bundle.mjs';
const folder=path.resolve('output/material-review-matte');await fs.mkdir(folder,{recursive:true});
const catalog=JSON.parse(await fs.readFile('output/equipment/catalog.json','utf8'));
const item=catalog.items.find(r=>r.models.some(m=>m.endsWith('/saber_mtx06_a01_v01.gr2')));
const samples=[['Atton-native',{...defaultState,weapon:'blaster_high02_a03'}],['Saber-native',{...defaultState,clip:'cb_warrior_saber_idle_1.jba',equipment:[{item:item.id,bone:'RightWeapon',blade:{enabled:true,core:'#ffffff',glow:'#ff2200',length:90,width:2,effect:'standard'}}]}]];
for(const [name,state] of samples){
 const result=await convert(state,'fbx',console.log);
 const manifest=await writeExportBundle(result,state,path.join(folder,name+'.fbx'));
 assert(manifest.materials.filter(m=>m.family!=='Saber').every(m=>!m.textures.specGloss&&!m.textures.roughness&&m.textureDimensions));
 if(name==='Saber-native'){
  assert.equal(result.parts.filter(p=>p.name.includes('_blade_')).length,6);
  assert(manifest.materials.some(m=>m.alphaMode==='additive'));
 }
 console.log('REVIEW_EXPORT_PASS',name);
}

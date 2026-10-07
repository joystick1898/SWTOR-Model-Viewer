import fs from 'node:fs/promises';
import path from 'node:path';
import {convert,defaultState} from '../src/backend.mjs';
import {editableBlade} from '../src/saber-layout.mjs';
import {writeExportBundle} from '../src/export-bundle.mjs';
import {validateState} from '../src/backend.mjs';
import assert from 'node:assert/strict';
const folder=path.resolve('output/live-saber-review');await fs.mkdir(folder,{recursive:true});
const catalog=JSON.parse(await fs.readFile('output/equipment/catalog.json','utf8'));
const item=catalog.items.find(r=>r.models.some(m=>m.endsWith('/saber_mtx06_a01_v01.gr2')))||catalog.items.find(r=>r.models.some(m=>m.endsWith('/saber_gs07_a01_v01.gr2')));
let state;
if(process.argv.includes('--edited'))state=JSON.parse(await fs.readFile(path.join(folder,'edited-state.json'),'utf8'));
else {const blade=editableBlade({enabled:true,effect:'standard'});for(const key of Object.keys(blade.layout))blade.layout[key]=true;state={...defaultState,clip:'cb_warrior_saber_idle_1.jba',equipment:[{item:item.id,bone:'RightWeapon',position:[0,0,0],rotation:[0,0,0],scale:1,blade}]};}
const result=await convert(state,'preview',console.log);const prefix=process.argv.includes('--edited')?'edited':'initial';
await fs.copyFile(result.file,path.join(folder,prefix+'.glb'));await fs.writeFile(path.join(folder,prefix+'.json'),JSON.stringify({state,result}));
console.log('LIVE_SABER_FIXTURE',result.parts.filter(p=>p.saberEdit).length);
if(process.argv.includes('--edited')){
 const saved=validateState(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(saved.equipment[0].blade.elements,state.equipment[0].blade.elements);
 assert.deepEqual(validateState(JSON.parse(JSON.stringify(saved))),saved);
 const exported=await convert(state,'fbx',console.log);
 const manifest=await writeExportBundle(exported,state,path.join(folder,'Live-edited-saber.fbx'));
 assert.deepEqual(manifest.preset.equipment,state.equipment);
 assert(exported.parts.filter(p=>p.saberEdit).length===18);
 console.log('LIVE_SABER_FBX_PASS');
}

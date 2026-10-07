import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {designerCatalog,designerOptions,importNpcDesigner} from '../src/designer.mjs';
import {convert,defaultState,validateState} from '../src/backend.mjs';
import {writeExportBundle} from '../src/export-bundle.mjs';
const data=await designerCatalog(),results=[];
const cases=Object.values(data.profiles).filter(p=>p.bodyType===2||p.species==='human');
for(const p of cases){
 try{
  let {designer}=await designerOptions({species:p.species,body:p.body});
  const state={...defaultState,version:2,character:'native-designer',designer,appearance:{body:p.body}};
  const preview=await convert(state,'preview');
  const bytes=await fs.readFile(preview.file),gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert(gltf.skins.length&&gltf.animations.length);assert(preview.parts.some(p=>p.slot==='head'));
  assert(gltf.materials.every(m=>m.pbrMetallicRoughness.baseColorTexture&&m.normalTexture));
  const saved=validateState(JSON.parse(JSON.stringify(preview.state)));assert.deepEqual(saved.designer,preview.state.designer);
  const exported=await convert({...saved,time:preview.duration*.35},'fbx');
  const destination=path.resolve('output/designer-validation',p.id.replace(':','-')+'.fbx');
  await writeExportBundle(exported,saved,destination);
  results.push({id:p.id,ok:true,parts:preview.parts.length,preview:preview.file,exported,destination});
  console.log('PASS',p.id,preview.parts.length);
 }catch(e){results.push({id:p.id,ok:false,error:e.stack});console.log('FAIL',p.id,e.message);}
 await fs.writeFile('reports/designer-pipeline-smoke.json',JSON.stringify({ok:results.every(r=>r.ok),results},null,2));
}
const imported=await importNpcDesigner('16141108995265840656-0');
const d=imported.designer;d.colors={'art/dynamic/chest/model/chest_baggy_bmn_med_ge_a02_shld.gr2':{primary:'#1144BB',secondary:'#E0B830'}};
const state={...defaultState,version:2,character:'native-designer',designer:d,equipment:[{item:'467aaf4e2ef3f5face348c1c',bone:'@skin',position:[0,0,0],rotation:[0,0,0],scale:1,colors:{'*':{primary:'#21813A',secondary:'#D43425'}}}]};
try{
 const preview=await convert(state,'preview');assert(preview.parts.some(p=>p.slot==='facehair'));
 const exported=await convert({...preview.state,time:.3},'fbx');const destination=path.resolve('output/designer-validation/Admiral-customized.fbx');await writeExportBundle(exported,preview.state,destination);
 results.push({id:'admiral-customized',ok:true,preview:preview.file,exported,destination});
}catch(e){results.push({id:'admiral-customized',ok:false,error:e.stack});}
await fs.writeFile('reports/designer-pipeline-smoke.json',JSON.stringify({ok:results.every(r=>r.ok),results},null,2));
console.log('DONE',results.length,results.filter(r=>!r.ok).length);

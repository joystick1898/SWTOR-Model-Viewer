import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {previewAsset} from '../src/backend.mjs';
const results=[];
for(const clip of ['ex_idle_1.jba','mv_walk_forward.jba','mv_run_forward.jba']){
  const result=await previewAsset('art/dynamic/creature/model/atst_walker_baron01.gr2',{clip});
  const bytes=Buffer.from(result.bytes),gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert(result.texturedMaterials>0);assert.equal(result.warnings.length,0);assert(gltf.animations.length>0&&gltf.skins.length>0);
  results.push({clip,bones:result.boneCount,frames:result.frames,textured:true});
}
const first=await previewAsset('art/dynamic/creature/model/atst_walker_mount01.gr2');
const second=await previewAsset(first.id,{material:first.materials[1]});
assert.equal(first.warnings.length,0);assert.equal(second.warnings.length,0);
assert.notEqual(createHash('sha256').update(first.bytes).digest('hex'),createHash('sha256').update(second.bytes).digest('hex'));
assert.notEqual(first.material,second.material);
await fs.writeFile('reports/asset-preview-smoke.json',JSON.stringify({ok:true,clips:results,variants:[first.material,second.material]},null,2));
console.log('PASS: textured idle/walk/run and native material variants');

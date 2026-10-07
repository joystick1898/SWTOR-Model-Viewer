import fs from 'node:fs/promises';
import path from 'node:path';
import {assetMetadata} from '../src/asset-metadata.mjs';
import {config,convertAsset} from '../src/backend.mjs';
import {writeExportBundle} from '../src/export-bundle.mjs';
const fixtures=JSON.parse(await fs.readFile('reports/asset-validation-fixtures.json','utf8')),results=[];
for(const [profile,source] of Object.entries(fixtures)){
  const id=source.replace(/^\//,'');
  try{
    const metadata=await assetMetadata(config.resources,{id,category:'creature'});
    const supported=metadata.clips.filter(c=>!metadata.unsupportedClips.includes(c));
    const clip=['mv_walk_forward.jba','ex_idle_1.jba','am_idle.jba'].find(c=>supported.includes(c))||supported.find(c=>c.includes('idle'))||supported[0];
    if(!clip)throw Error('No mapped animation');
    const preview=await convertAsset(id,{clip});
    const exported=await convertAsset(id,{clip,time:preview.duration*.35},'fbx');
    const destination=path.resolve('output/browser-examples',profile+'.fbx');
    await writeExportBundle(exported,{asset:id,clip,time:preview.duration*.35},destination);
    results.push({profile,id,clip,ok:true,playable:supported.length,total:metadata.clips.length,preview:{bones:preview.boneCount,animated:preview.animatedBones,textured:preview.texturedMaterials,warnings:preview.warnings},exported,destination});
    console.log(profile,'PASS',supported.length,'clips',preview.texturedMaterials,'materials',preview.warnings.length,'warnings');
  }catch(e){results.push({profile,id,ok:false,error:e.message});console.log(profile,'FAIL',e.message.slice(-500));}
  await fs.writeFile('reports/browser-coverage-smoke.json',JSON.stringify({ok:results.every(r=>r.ok),results},null,2));
}

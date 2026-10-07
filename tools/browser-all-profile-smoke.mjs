import fs from 'node:fs/promises';import path from 'node:path';import {config,convertAsset} from '../src/backend.mjs';import {writeExportBundle} from '../src/export-bundle.mjs';
const input=JSON.parse(await fs.readFile('output/all-actor-validation-input.json','utf8')),profiles=[...new Set(input.assets.filter(a=>a.profile).map(a=>a.profile))],results=[];
for(const profile of profiles){
 const asset=input.assets.find(a=>a.profile===profile&&!a.parentAsset)||input.assets.find(a=>a.profile===profile),clip=input.motions[profile].clip;
 try{
  const preview=await convertAsset(asset.id,{clip}),time=preview.duration*.35,exported=await convertAsset(asset.id,{clip,time},'fbx'),destination=path.resolve('output/all-profile-examples',profile+'.fbx');
  await writeExportBundle(exported,{asset:asset.id,clip,time},destination);
  results.push({profile,id:asset.id,clip,ok:true,playable:asset.mapped,total:asset.total,preview:{bones:preview.boneCount,animated:preview.animatedBones,textured:preview.texturedMaterials,warnings:preview.warnings},exported:{file:exported.file,parts:exported.parts,boneCount:exported.boneCount,rigged:exported.rigged,materialDetails:exported.materialDetails,textureFiles:exported.textureFiles,warnings:exported.warnings},destination});console.log(profile,'PASS','materials',preview.texturedMaterials,'warnings',preview.warnings.length);
 }catch(e){results.push({profile,id:asset.id,clip,ok:false,error:e.message});console.log(profile,'FAIL',e.message.slice(-600));}
 await fs.writeFile('reports/all-profile-export-smoke.json',JSON.stringify({complete:false,ok:results.every(r=>r.ok),results},null,2));
}
await fs.writeFile('reports/all-profile-export-smoke.json',JSON.stringify({complete:true,ok:results.every(r=>r.ok),results},null,2));

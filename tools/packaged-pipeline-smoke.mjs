import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
const project=process.cwd(),build=JSON.parse(await fs.readFile('dist/latest.json','utf8'));
const settings=JSON.parse(await fs.readFile('output/packaged-smoke-home/settings.json','utf8'));
const app=path.join(build.app,'resources/app'),runtime=path.join(build.app,'resources/runtime');
Object.assign(process.env,{SWTOR_PACKAGED:'1',SWTOR_DATA:settings.data,SWTOR_RESOURCES:settings.resources,SWTOR_GAME:settings.game,SWTOR_BLENDER:path.join(runtime,'blender/blender.exe'),SWTOR_PYTHON:path.join(runtime,'python/python.exe'),SWTOR_ADDONS:path.join(runtime,'addons'),SWTOR_FIXTURE:'',PATH:path.join(process.env.SystemRoot,'System32'),PYTHONHOME:'',PYTHONPATH:'',PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'});
const backend=await import(pathToFileURL(path.join(app,'src/backend.mjs')));
const {writeExportBundle}=await import(pathToFileURL(path.join(app,'src/export-bundle.mjs')));
const {assetMetadata}=await import(pathToFileURL(path.join(app,'src/asset-metadata.mjs')));
const output=path.join(project,'output/standalone-exports');await fs.mkdir(output,{recursive:true});
const preset=JSON.parse(await fs.readFile('tests/fixtures/packaged-pike.pose.json','utf8'));
const npc=(await backend.npcs({query:'Aric Jorgan',offset:0})).items.find(n=>n.ready);
const walker=(await backend.assets({query:'atst_walker_baron01',offset:0})).items.find(n=>n.id.endsWith('/atst_walker_baron01.gr2'));
if(!npc||!walker)throw Error('Missing representative fixtures');
const walkerMetadata=await assetMetadata(settings.resources,walker);
const walkerClip=walkerMetadata.clips.find(c=>c.includes('walk')&&!walkerMetadata.unsupportedClips.includes(c));
if(!walkerClip)throw Error('No supported walker clip');
const results=[];
for(const [id,state,convert] of [
  ['designer-pike',preset,mode=>backend.convert(preset,mode,console.log)],
  ['npc-aric',{id:npc.id},mode=>backend.convertNpc(npc.id,{time:0,exportRig:true},mode,console.log)],
  ['walker',{id:walker.id},mode=>backend.convertAsset(walker.id,{clip:walkerClip,time:0,exportRig:true},mode)]
]){
  console.log('Testing packaged',id);
  const preview=await convert('preview');
  const exported=await convert('fbx');
  const destination=path.join(output,id+'.fbx');
  await writeExportBundle(exported,state,destination);
  results.push({id,ok:true,preview:{file:preview.file,bones:preview.boneCount},exported:{file:exported.file,boneCount:exported.boneCount,profile:exported.profile,clip:exported.clip,rigged:exported.rigged,materialCount:exported.materialDetails.length},destination});
}
const report=path.join(project,'reports/standalone-pipeline.json');
await fs.writeFile(report,JSON.stringify({ok:true,package:build.app,runtime:backend.config,results},null,2));
const child=spawn(process.env.SWTOR_BLENDER,['--background','--factory-startup','--python-exit-code','1','--python',path.join(project,'tools/verify-standalone.py'),'--',report],{windowsHide:true,env:process.env});
child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr);await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code?reject(Error('Packaged FBX verification failed')):resolve());});
console.log('PACKAGED PIPELINE PASS');

// Generate fresh exports with the viewer runtime, then inspect unmodified ZG
// imports in two isolated Blender processes per case. Never edits user add-ons.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {parseArgs} from 'node:util';
const {values:args}=parseArgs({options:{
  blender:{type:'string'},addons:{type:'string'},settings:{type:'string'},output:{type:'string'},
}});
if(!args.blender||!args.addons)throw Error('Required: --blender PATH --addons PATH; optional --settings viewer-settings.json --output DIRECTORY');
if(args.settings){
  const settings=JSON.parse(await fs.readFile(args.settings,'utf8'));
  for(const key of ['resources','game','data'])if(settings[key])process.env['SWTOR_'+key.toUpperCase()]=settings[key];
}
const {exportZGCharacter,defaultState,equipment,npcs,config}=await import('../src/backend.mjs');
const {writeZGPackage}=await import('../src/zg-export.mjs');
const root=path.resolve(args.output||'output/zg-compatibility-'+Date.now());
await fs.mkdir(path.dirname(root),{recursive:true});
await fs.mkdir(root); // A new evidence directory prevents stale reports on reruns.
const cases=[];
function designer(name,body='bmn',species='human',extra={}){
  cases.push({name,request:{kind:'designer',state:{...defaultState,version:2,character:'native-designer',clip:null,
    designer:{species,body,choices:{},colors:{skin:{primary:'#D0A080'},eyes:{primary:'#4080C0'},hair:{primary:'#482D18'}}},...extra}}});
}
for(const body of ['bma','bmn','bms','bmf','bfa','bfn','bfs','bfb'])designer('native-'+body,body);
for(const species of ['twilek','togruta','chiss'])designer(species,'bfn',species);
const jacket=(await equipment({query:"Atton Rand's Jacket"})).items.find(e=>e.category==='chest');
if(!jacket)throw Error('Required jacket fixture missing');
designer('jacket-dyed','bmn','human',{equipment:[{item:jacket.id,bone:'@skin',colors:{'*':{primary:'#8040C0',secondary:'#20A060'}}}]});
designer('jacket-fine-tuned','bmn','human',{equipment:[{item:jacket.id,bone:'@skin',colors:{'*':{primary:'#FF0000',primaryPalette:{hue:.9,saturation:0,brightness:-.032,contrast:1.029}}}}]});
for(const name of ['Atton','Lana Beniko','Theron Shan']){
  const npc=(await npcs({query:name})).items.find(n=>n.ready);
  if(npc)cases.push({name:'npc-'+name.replaceAll(' ','-'),request:{kind:'npc',id:npc.id,selection:{}}});
  else cases.push({name:'npc-'+name,unavailable:'No ready NPC fixture'});
}
function run(exe,argv,logFile){return new Promise((resolve,reject)=>{
  const child=spawn(exe,argv,{windowsHide:true});let log='';
  const timer=setTimeout(()=>child.kill(),180000);
  child.stdout.on('data',d=>{log+=d;});child.stderr.on('data',d=>{log+=d;});
  child.on('error',e=>{clearTimeout(timer);reject(e);});
  child.on('close',async code=>{clearTimeout(timer);try{await fs.writeFile(logFile,log);resolve(code);}catch(e){reject(e);}});
});}
const results=[];
for(const item of cases){
  const record={name:item.name};results.push(record);
  if(item.unavailable){record.exportError=item.unavailable;continue;}
  try{
    const result=await exportZGCharacter(item.request);
    const saved=await writeZGPackage(result,path.join(root,item.name,'export'));
    record.export={models:result.paths.flatMap(s=>s.models).length,warnings:result.warnings,colorsTranslated:result.colorsTranslated};
    for(const [label,blender] of [['baseline',config.blender],['target',args.blender]]){
      const folder=path.join(root,item.name,label);await fs.mkdir(path.join(folder,'assets'),{recursive:true});
      for(const file of ['paths.json','preset.json','skeleton.json'])await fs.copyFile(path.join(saved.folder,'assets',file),path.join(folder,'assets',file));
      const report=path.join(folder,'report.json'),log=path.join(folder,'blender.log');
      const code=await run(blender,['--background','--factory-startup','--disable-autoexec','--python-exit-code','1',
        '--python',path.resolve('tools/verify-zg-import.py'),'--','--package',folder,'--zg-addons',args.addons,
        '--gr2-addons',args.addons,'--resources',result.recoveredResources?.length?path.join(saved.folder,'Resources'):config.resources,
        '--report',report,'--inspect-collection-error','--no-save'],log);
      let detail;try{detail=JSON.parse(await fs.readFile(report,'utf8'));}catch{}
      record[label]={exitCode:code,report:detail||null,log};
      console.log(item.name,label,detail?.passed?'PASS':detail?.sceneDataPassed?'SCENE_PASS_COLLECTION_ERROR':'FAIL');
    }
  }catch(error){record.exportError=error.message;console.log(item.name,'ERROR',error.message);}
  await fs.writeFile(path.join(root,'summary.json'),JSON.stringify({date:new Date().toISOString(),exportRuntime:config.blender,targetRuntime:args.blender,addons:args.addons,results},null,2));
}
await fs.writeFile(path.join(root,'summary.json'),JSON.stringify({date:new Date().toISOString(),exportRuntime:config.blender,targetRuntime:args.blender,addons:args.addons,results},null,2));
console.log('Evidence:',path.join(root,'summary.json'));
if(results.some(r=>r.exportError||r.baseline?.exitCode!==0||r.target?.exitCode!==0||!r.baseline?.report?.passed||!r.target?.report?.passed))process.exitCode=1;

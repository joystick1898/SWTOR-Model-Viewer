import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {config,project,dataPath} from './runtime.mjs';

export async function prepareZGExport(assembly,state,notify=()=>{}){
  await fs.mkdir(dataPath(),{recursive:true});
  const folder=await fs.mkdtemp(dataPath('zg-export-'));
  try{
    const output=path.join(folder,'package.json'),input=path.join(folder,'request.json');
    await fs.writeFile(input,JSON.stringify({...config,assembly,state,output}));
    notify('Translating character materials and checking ZG dependencies…');
    await new Promise((resolve,reject)=>{
      const child=spawn(config.blender,['--background','--factory-startup','--disable-autoexec','--python-exit-code','1','--python',path.join(project,'worker/export_zg.py'),'--',input],{cwd:project,windowsHide:true});
      let log='',timedOut=false;
      const append=d=>{log=(log+d.toString()).slice(-16000);};
      child.stdout.on('data',append);child.stderr.on('data',append);
      const timer=setTimeout(()=>{timedOut=true;child.kill();},300000);
      child.on('error',e=>{clearTimeout(timer);reject(e);});
      child.on('close',code=>{clearTimeout(timer);if(code===0&&!timedOut)resolve();else{
        const detail=log.match(/ValueError: ([\s\S]*?)(?:\n\n|\nBlender quit|$)/)?.[1]||log.slice(-1800);
        reject(Error(timedOut?'ZG export timed out.':'ZG export: '+detail.trim()));
      }});
    });
    return JSON.parse(await fs.readFile(output,'utf8'));
  }finally{await fs.rm(folder,{recursive:true,force:true});}
}

export async function writeZGPackage(result,destination){
  destination=path.resolve(destination);
  try{await fs.access(destination);throw Error('Choose a new export folder; existing exports are not overwritten.');}catch(e){if(e.code!=='ENOENT')throw e;}
  await fs.mkdir(path.dirname(destination),{recursive:true});
  const stage=await fs.mkdtemp(path.join(path.dirname(destination),'.zg-export-'));
  try{
    const assets=path.join(stage,'assets');await fs.mkdir(assets);
    for(const [name,value] of [['paths',result.paths],['skeleton',result.skeleton],['preset',result.preset]])
      await fs.writeFile(path.join(assets,name+'.json'),JSON.stringify(value,null,2)+'\n');
    // If this character relies on recovered assets, supply a complete minimal
    // Resources tree so ZG need not know about the viewer's private cache.
    const bundled=!!result.recoveredResources?.length;
    if(bundled)for(const [relative,source] of Object.entries(result.dependencies)){
      if(!relative.startsWith('art/')||relative.split('/').some(p=>!p||p==='..'||p==='.')||relative.includes(':')||relative.includes('\\'))throw Error('Invalid resource dependency');
      const target=path.join(stage,'Resources',relative);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(source,target);
    }
    const warnings=[...new Set(result.warnings||[])];
    const instructions=[
      'SWTOR Model Viewer — ZG Tools character export',
      '',
      '1. Enable ZG SWTOR Tools and its matching GR2 importer in Blender.',
      bundled?'2. Set ZG Tools Resources folder to the Resources folder included in this export. It contains the dependencies recovered for this character.':'2. Set ZG Tools Resources folder to the same complete extracted game Resources used for this character.',
      '3. Start in a clean Blender scene, open Character Assembler and select assets/paths.json. Existing imported character materials may otherwise be reused by ZG.',
      '4. Enable Import Rigging Skeleton and Bind Objects To Skeleton.',
      '',
      'Test target: ZG Tools 2.0.14 with its paired GR2 importer 4.2.1.',
      'This transfers character appearance in the native rest pose. Animation, facial pose, weapons, arbitrary bone attachments and saber effects are not transferred.',
      'The supplied skeleton.json always identifies the rig; the FBX Include skeleton checkbox does not change this export.',
      'ZG creates paths_corrected.json and gathers assets itself. Save viewer character presets separately; preset.json here contains gear names only.',
      ...warnings.map(w=>'Note: '+w),
    ].join('\n')+'\n';
    await fs.writeFile(path.join(stage,'ZG_IMPORT.txt'),instructions);
    // Windows scanners can briefly hold newly copied DDS/GR2 files open.
    for(let attempt=0;;attempt++)try{await fs.rename(stage,destination);break;}catch(error){
      if(!['EPERM','EBUSY','EACCES'].includes(error.code)||attempt===8)throw error;
      await new Promise(resolve=>setTimeout(resolve,100*(attempt+1)));
    }
    return {file:path.join(destination,'assets/paths.json'),folder:destination,warnings,colorsTranslated:result.colorsTranslated,bundledResources:bundled};
  }catch(e){await fs.rm(stage,{recursive:true,force:true,maxRetries:5,retryDelay:100});throw e;}
}

export function zgFolderName(name='Character'){
  const clean=String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,70)||'Character';
  return clean+'-ZG-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,6);
}

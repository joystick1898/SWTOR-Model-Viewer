import {expressionLibrary,validateExpression} from './expressions.mjs';
import {designerOptions,importNpcDesigner,assembleDesigner,validateDesigner} from './designer.mjs';
export {designerOptions,importNpcDesigner};
import fs,{resolvedResource} from './resource-files.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {readCachedConversion} from './conversion-cache.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {readNativeJba} from '../tools/native-jba.mjs';
import {readNativeRig,mapBmnTracks} from '../tools/native-rig.mjs';
import {appearance,appearanceDefaults,assembleCharacter,designerCatalog,bodyProfiles} from './character.mjs';
import {assetIndex,searchAssets} from './asset-index.mjs';
import {assetMetadata,assetMotion} from './asset-metadata.mjs';
import {searchNpcs,npcRecord,prepareNpc} from './npc-catalog.mjs';
import {decodeAssetMotion} from './animation-library.mjs';
import {equipmentSearch,validateEquipment,resolveEquipment} from './equipment.mjs';
import {prepareZGExport} from './zg-export.mjs';
export const equipment=equipmentSearch;
export const npcs=searchNpcs;
export const assets=query=>searchAssets(config.resources,query);
import {project,config,dataPath} from './runtime.mjs';
export {project,config};
const animationDirectory=path.join(config.resources,'anim/humanoid/bmnnew');
export function validateState(value) {
  if(!value||!((value.version===1&&value.character==='atton-reference')||(value.version===2&&value.character==='native-designer')))throw Error('Unsupported character preset');
  if(!(value.version===2&&value.clip===null)&&(typeof value.clip!=='string'||!/^[a-z0-9_]+\.jba$/i.test(value.clip)||value.clip.startsWith('ad_')))throw Error('Choose an ordinary humanoid clip; additive playback is not supported yet');
  if(typeof value.time!=='number'||!Number.isFinite(value.time)||value.time<0||value.time>3600)throw Error('Invalid pose time');
  if(!Array.isArray(value.hidden)||value.hidden.length>100||value.hidden.some(n=>typeof n!=='string'||n.length>200))throw Error('Invalid attachment visibility');
  if(typeof value.rootMotion!=='boolean')throw Error('Invalid root motion option');
  const weapon=value.weapon??'none';
  if(!['none','blaster_high02_a03'].includes(weapon))throw Error('Unsupported weapon');
  const exportRig=value.exportRig??true;if(typeof exportRig!=='boolean')throw Error('Invalid skeleton export option');
  return {...(value.version===2?{version:2,character:'native-designer',designer:validateDesigner(value.designer)}:{version:1,character:'atton-reference'}),expression:validateExpression(value.expression),clip:value.clip,time:value.time,hidden:[...new Set(value.hidden)],rootMotion:value.rootMotion,weapon,exportRig,equipment:validateEquipment(value.equipment),appearance:appearance(value.version===2?{body:value.designer?.body||'bmn'}:value.appearance)};
}
export const defaultState={expression:null,version:1,character:'atton-reference',clip:'cb_pistol_normal_to_combat.jba',time:0,hidden:[],rootMotion:false,weapon:'none',exportRig:true,equipment:[],appearance:appearanceDefaults};
export async function exportZGCharacter(value,notify=()=>{}){
  if(busy)throw Error('A conversion is already running');
  busy=true;
  try{
    notify('Resolving the character for ZG Tools…');
    let state,assembly,name='Character',warnings=[];
    if(value?.kind==='npc'){
      const record=await npcRecord(value.id);name=record.name;warnings=record.warnings||[];
      assembly=await prepareNpc(config.resources,record,{animations:false});
      state={equipment:validateEquipment(value.selection?.equipment),hidden:[],weapon:'none'};
    }else if(value?.kind==='designer'){
      state=validateState(value.state);
      // The preview records the actual Blender object name alongside its asset.
      // Do not infer that name from the GR2 again when exporting visibility.
      if(value.parts!==undefined){
        if(!Array.isArray(value.parts)||value.parts.length>512)throw Error('Invalid preview parts');
        state.previewParts=value.parts.map(p=>{
          if(!p||typeof p!=='object'||typeof p.name!=='string'||!p.name||p.name.length>200||typeof p.source!=='string'||p.source.length>300||!/^\/?art\/(?!.*(?:^|\/)\.{1,2}(?:\/|$))[^:\x00\r\n\\]+\.gr2$/i.test(p.source)||p.equipmentLayer!==undefined&&(!Number.isInteger(p.equipmentLayer)||p.equipmentLayer<0||p.equipmentLayer>=state.equipment.length))throw Error('Invalid preview part');
          return {name:p.name,source:p.source,...(p.equipmentLayer!==undefined?{equipmentLayer:p.equipmentLayer}:{})};
        });
      }
      if(state.version===2)assembly=await assembleDesigner(config.resources,config.fixture,state.designer,{animations:false});
      else{
        if(!config.fixture)throw Error('This legacy character needs the original Atton reference files.');
        assembly=await assembleCharacter(config.resources,config.fixture,state.appearance);name='Character';
      }
      warnings=assembly.designerWarnings||[];
    }else throw Error('ZG export is available for Character Designer and NPC Browser.');
    assembly.equipment=await resolveEquipment(state.equipment,assembly.profile.id);
    const result=await prepareZGExport(assembly,state,notify);
    result.warnings.push(...warnings);
    return {...result,name};
  }finally{busy=false;}
}
export async function catalog(body='bmn'){
  const profile=bodyProfiles.find(p=>p.id===body);if(!profile)throw Error('Unknown body profile');
  const clips=(await fs.readdir(path.join(config.resources,profile.animationDirectory))).filter(n=>n.endsWith('.jba')&&!n.startsWith('ad_')).sort();
  const gear=[];
  return {clips,gear,defaultState,resources:config.resources,profiles:await designerCatalog(config.resources)};
}
export async function nativeMotion(clip,profile){
  const directory=path.join(config.resources,profile.animationDirectory);
  const jba=await fs.readFile(path.join(directory,clip));
  const native=readNativeJba(jba);
  if(profile.id!=='bmn'){
    let canonical;try{canonical=await fs.readFile(path.join(animationDirectory,clip));}catch{}
    const shared=canonical&&(canonical.equals(jba)||JSON.stringify(readNativeJba(canonical).motion)===JSON.stringify(native.motion));
    if(!shared)throw Error('This body-specific clip needs a verified source rig mapping. Shared humanoid clips such as the default pistol transition are supported.');
  }
  // Folder placement does not identify animation track order. Shared clips are
  // identical bmn bone motions even in libraries whose MPH bone order differs.
  const mph=await fs.readFile(path.join(animationDirectory,'anim_library.mph'));
  if(native.tracks!==102)throw Error(`This build supports the validated 102-track humanoid profile. This clip has ${native.tracks} tracks.`);
  native.sourceBind=mapBmnTracks(readNativeRig(mph),native.tracks);
  native.names=native.sourceBind.map(b=>b.name==='GOD'?'Bip01':b.name);
  native.sourceProfile='bmnnew-102';
  return native;
}
let busy=false;
export const previewAsset=(id,selection={})=>convertAsset(id,selection,'preview');
export async function convertAsset(id,selection={},mode='preview'){
  if(!['preview','fbx'].includes(mode))throw Error('Unknown conversion mode');
  const time=selection.time??0,exportRig=selection.exportRig??true;
  if(typeof time!=='number'||!Number.isFinite(time)||time<0||time>3600||typeof exportRig!=='boolean')throw Error('Invalid export pose');
  if(busy)throw Error('A conversion is already running');
  if(typeof id!=='string')throw Error('Invalid resource');
  busy=true;
  try{
    const asset=(await assetIndex(config.resources)).find(a=>a.id===id);if(!asset)throw Error('Resource is not in the catalog');
    const metadata=await assetMetadata(config.resources,asset);
    const equipment=await resolveEquipment(selection.equipment,metadata.profile?.replace(/new$/,'')||'bmn');
    const material=selection.material??null,clip=selection.clip??null;
    if(material&&!metadata.materials.includes(material))throw Error('Material is not associated with this resource');
    const motion=clip?await assetMotion(config.resources,metadata,clip):null;
    if(time>(motion?.duration||0)+.001)throw Error('Pose time exceeds resource animation');
    const source=resolvedResource(path.join(config.resources,id)),stat=await fs.stat(source);
    const folder=dataPath('asset-cache',createHash('sha256').update(JSON.stringify({revision:46,equipment,id,mtime:stat.mtimeMs,material,clip,mode,time:mode==='fbx'?time:0,exportRig,mapping:metadata.mappingSignature})).digest('hex'));
    await fs.mkdir(folder,{recursive:true});const output=path.join(folder,mode==='preview'?'preview.glb':'posed-asset.fbx');
    let report=await readCachedConversion(path.join(folder,'result.json'),output);
    if(!report){
      await fs.rm(path.join(folder,'result.json'),{force:true});
      const input=path.join(folder,'request.json');await fs.writeFile(input,JSON.stringify({...config,source,output,metadata,material,motion,mode,time,exportRig,clip,equipment}));
      await new Promise((resolve,reject)=>{
        const child=spawn(config.blender,['--background','--factory-startup','--disable-autoexec','--python-exit-code','1','--python',path.join(project,'worker/asset-preview.py'),'--',input],{windowsHide:true});
        let log='';child.stdout.on('data',d=>log=(log+d).slice(-3000));child.stderr.on('data',d=>log=(log+d).slice(-3000));
        const timer=setTimeout(()=>child.kill(),600000);
        child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Resource preview failed: '+log.slice(-900)));});
      });
    }
    report??=JSON.parse(await fs.readFile(path.join(folder,'result.json'),'utf8'));
    return {...metadata,...report,clip,material,...(mode==='preview'?{bytes:new Uint8Array(await fs.readFile(output))}:{})};
  }finally{busy=false;}
}
export async function convert(value,mode='preview',notify=()=>{}){
  const state=validateState(value);
  if(state.version===2){
    const assembly=await assembleDesigner(config.resources,config.fixture,state.designer);
    const clips=assembly.clips.filter(c=>!assembly.unsupportedClips.includes(c));
    const warnings=[...(assembly.designerWarnings||[])];
    if(state.clip!==null&&!clips.includes(state.clip)){warnings.push('Animation '+state.clip+' is unavailable for this body/resource snapshot. A supported animation is shown instead.');state.clip=clips.find(c=>c.includes('idle')&&!/death|dead|sleep/.test(c))||clips[0];state.time=0;}
    state.designer=assembly.designer;state.appearance=assembly.appearance;
    const result=await convertCharacter(state,mode,notify,assembly);
    return {...result,state,clips,warnings};
  }
  if(!config.fixture)throw Error('This version-1 character preset needs the legacy Atton fixture, which is not included in the standalone app. It remains usable in the development viewer. Current native Character Designer version-2 presets are portable.');
  return convertCharacter(state,mode,notify);
}
export async function convertNpc(id,selection={},mode='preview',notify=()=>{}){
  notify('Reading NPC appearance…');
  const record=await npcRecord(id),assembly=await prepareNpc(config.resources,record);
  const clip=selection.clip===null?null:selection.clip??assembly.clips.find(c=>c.includes('idle')&&!/death|dead|die|sleep/.test(c)&&!assembly.unsupportedClips.includes(c))??assembly.clips.find(c=>!assembly.unsupportedClips.includes(c));
  if(clip!==null&&(!assembly.clips.includes(clip)||assembly.unsupportedClips.includes(clip)))throw Error('Animation unavailable for this NPC');
  const time=selection.time??0,exportRig=selection.exportRig??true;
  if(typeof time!=='number'||!Number.isFinite(time)||time<0||time>3600||typeof exportRig!=='boolean')throw Error('Invalid NPC pose');
  const state={version:1,character:id,expression:validateExpression(selection.expression),clip,time,hidden:[],rootMotion:false,weapon:'none',exportRig,equipment:validateEquipment(selection.equipment),appearance:assembly.appearance};
  const result=await convertCharacter(state,mode,notify,assembly);
  return {...result,id,name:record.name,fqn:record.fqn,source:record.source,clips:assembly.clips,unsupportedClips:assembly.unsupportedClips,warnings:[...(record.warnings||[]),'NPC appearance, names and animations read from local game files.',...(Object.keys(record.randomizedSlots||{}).length?['Native randomized appearance: showing first candidate per slot.']:[])]};
}
async function convertCharacter(state,mode,notify,npcAssembly){
  if(!['preview','fbx'].includes(mode))throw Error('Unknown conversion mode');
  if(busy)throw Error('A conversion is already running');
  busy=true;
  try{
    notify('Decoding native animation…');
    const assembly=npcAssembly||await assembleCharacter(config.resources,config.fixture,state.appearance);
    const expressions=await expressionLibrary(config.resources,assembly.profile.animationDirectory);
    const expression=expressions.find(e=>e.id===state.expression);
    if(state.expression&&state.expression!=='neutral'&&!expression)throw Error('This facial expression is unavailable for the selected skeleton');
    const expressionInfo={expression:state.expression||null,expressions:expressions.map(({id,label})=>({id,label}))};
    assembly.equipment=await resolveEquipment(state.equipment,assembly.profile.id);
    const motionClip=state.clip||assembly.clips?.find(c=>!assembly.unsupportedClips.includes(c));
    const motion=npcAssembly?await decodeAssetMotion(config.resources,assembly.profile.animationDirectory,motionClip):await nativeMotion(state.clip,assembly.profile);
    if(npcAssembly){if(state.clip===null){motion.frames=1;motion.duration=0;motion.motion=motion.sourceBind.map(b=>({translations:[b.translation],rotations:[b.rotation]}));}}
    if(state.time>motion.duration+0.001)throw Error('Pose time exceeds the selected animation');
    const sourceStat=await fs.stat(path.join(config.resources,assembly.profile.animationDirectory,motionClip));
    const key=createHash('sha256').update(JSON.stringify({revision:55,assembly,state:{...state,time:mode==='preview'?0:state.time,hidden:mode==='preview'?[]:state.hidden},mode,mtime:sourceStat.mtimeMs})).digest('hex');
    const output=dataPath('app-cache',key);
    const resultPath=path.join(output,'result.json');
    const cached=await readCachedConversion(resultPath);
    if(cached){notify('Loaded cached preview');return {...cached,...expressionInfo};}
    await fs.mkdir(output,{recursive:true});
    await fs.rm(resultPath,{force:true});
    const request={...config,state,motion,expression,assembly,mode,output};
    const input=path.join(output,`request-${randomUUID()}.json`);
    await fs.writeFile(input,JSON.stringify(request));
    notify(mode==='preview'?'Assembling character and animation…':'Exporting the selected pose…');
    await new Promise((resolve,reject)=>{
      const child=spawn(config.blender,['--background','--factory-startup','--disable-autoexec','--python-exit-code','1','--python',path.join(project,'worker/convert.py'),'--',input],{cwd:project,windowsHide:true});
      let log='';const append=data=>{log=(log+data.toString()).slice(-20000);};
      child.stdout.on('data',append);child.stderr.on('data',append);
      let timedOut=false;
      // Cleanup may run after rejection, so wait for the writer to actually exit.
      const timeout=setTimeout(()=>{timedOut=true;child.kill();},600000);
      child.on('error',error=>{clearTimeout(timeout);reject(error);});
      child.on('close',async code=>{clearTimeout(timeout);try{await fs.writeFile(path.join(output,'worker.log'),log);timedOut?reject(Error('Conversion timed out after ten minutes')):code===0?resolve():reject(Error(`Conversion failed. ${log.slice(-1800)}`));}catch(error){reject(error);}});
    });
    return {...JSON.parse(await fs.readFile(resultPath,'utf8')),...expressionInfo};
  }finally{busy=false;}
}






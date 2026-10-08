import {organizeWorkspace} from './workspace.js';
organizeWorkspace();
import {resizablePanels} from './panels.js';
resizablePanels();
import {saberMaterial,updateSaberTime} from './saber-material.js';
import {saberFXMaterial} from './saber-fx-material.js';
import {nativeDesigner} from './designer.js';
import {liveEquipment} from './live-equipment.js';
import {equipmentUI} from './equipment.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {hexToHsl,hueToHex} from './color.mjs';
const $=id=>document.getElementById(id),api=window.viewer;
$('settings').onclick=()=>{if(!busy)api.settings();};
const scene=new THREE.Scene();scene.background=new THREE.Color('#10171d');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
$('viewport').append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(35,1,.01,100);camera.position.set(3,1.6,4);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,1,0);
scene.add(new THREE.HemisphereLight(0xd5eaff,0x39404b,2.4));
const key=new THREE.DirectionalLight(0xffe3b6,3.4);key.position.set(2,4,3);scene.add(key);
const rim=new THREE.DirectionalLight(0x8abce9,2.5);rim.position.set(-3,2,-2);scene.add(rim);
const grid=new THREE.GridHelper(6,30,0x405461,0x25333d);scene.add(grid);
let model,mixer,meta,state,catalog,busy=false,playing=false,wire=false,elapsed=0;
let workspace='designer',draft,assetOffset=0,assetTotal=0,searchSequence=0,assetMeta;
function status(message){$('status').textContent=message;}
api.progress(status);
const designerUI=nativeDesigner(api,{getState:currentState,apply:load,status});
const equipmentEditor=liveEquipment({scene,camera,renderer,orbit:controls,getContext:()=>({equipment:(workspace==='designer'?state?.equipment:assetMeta?.equipment)||[]}),setEntry:(i,value)=>{if(workspace==='designer')state.equipment[i]=value;else assetMeta.equipment[i]=value;},pause:()=>{playing=false;$('play').textContent='Play';},status,prepare:async(i,value)=>{const equipment=structuredClone((workspace==='designer'?state:assetMeta).equipment||[]);equipment[i]=value;const time=elapsed;const pos=camera.position.clone(),target=controls.target.clone();const ok=workspace==='designer'?await load({...currentState(),equipment}):await loadAsset(assetMeta,{clip:assetMeta.clip,material:assetMeta.material,equipment});if(ok){seek(time);camera.position.copy(pos);controls.target.copy(target);equipmentEditor.select(i);}return ok;}});
const refreshEquipmentPanel=equipmentUI(api,()=>({identity:workspace+":"+(workspace==="designer"?(state?.designer?.species||"legacy")+":"+(state?.designer?.body||state?.appearance?.body)+":"+(state?.designer?.sourceNpc||""):assetMeta?.id||""),labels:activeMeta()?.equipmentLabels||{},warnings:activeMeta()?.equipmentWarnings||[],parts:activeMeta()?.parts||[],components:activeMeta()?.equipmentComponents||{},bones:activeMeta()?.bones||[],equipment:workspace==='designer'?state?.equipment:assetMeta?.equipment}),async equipment=>{const time=elapsed;const ok=workspace==='designer'?await load({...currentState(),equipment}):await loadAsset(assetMeta,{clip:assetMeta.clip,material:assetMeta.material,equipment});if(ok)seek(time);return ok;});
function refreshEquipment(){refreshExpressions();refreshEquipmentPanel();equipmentEditor.bind(model,activeMeta());}
function refreshExpressions(){
 const data=activeMeta(),options=data?.expressions||[];
 $('expressionPanel').hidden=workspace==='browser';
 $('expressionSelect').replaceChildren(new Option('Animation default',''),new Option('Neutral','neutral'),...options.map(e=>new Option(e.label,e.id)));
 $('expressionSelect').value=(workspace==='designer'?state?.expression:data?.expression)||'';
 $('expressionSelect').disabled=busy;
 $('expressionReset').disabled=busy||!data;
 $('expressionHelp').textContent=options.length?'Native facial poses. Applies immediately and is included in FBX export.':'No mapped facial poses available for this skeleton.';
}
async function applyExpression(expression){
 const time=elapsed;
 const cameraPosition=camera.position.clone(),target=controls.target.clone();
 const ok=workspace==='designer'?await load({...currentState(),expression}):await loadAsset(assetMeta,{clip:assetMeta.clip,expression});
 if(ok){seek(time);camera.position.copy(cameraPosition);controls.target.copy(target);controls.update();}
 refreshExpressions();
}
$('expressionSelect').onchange=()=>applyExpression($('expressionSelect').value||null);
$('expressionReset').onclick=()=>applyExpression('neutral');
function lock(value){busy=value;refreshEquipmentPanel.setBusy(value);$('expressionReset').disabled=value||!activeMeta();$('expressionSelect').disabled=value;for(const el of $('nativeDesigner').querySelectorAll('input,select,button'))el.disabled=value;$('nativeApply').disabled=value;$('npcToDesigner').disabled=value||!assetMeta;$('npcToDesigner').hidden=workspace!=='npc';equipmentEditor.setBusy(value);$('equipmentOpen').disabled=value||!activeMeta();for(const id of ['open','save','rootMotion','applyAppearance','resetAppearance'])$(id).disabled=value||workspace!=='designer';$('export').disabled=value||(workspace!=='designer'&&!assetMeta);for(const id of ['play','timeline','speed'])$(id).disabled=value||!mixer;for(const id of ['assetAnimation','assetMaterial'])$(id).disabled=value||!assetMeta;$('designerTab').disabled=value;$('browserTab').disabled=value;$('npcTab').disabled=value;}
function activeMeta(){return workspace!=='designer'?assetMeta:meta;}
function seek(value){const duration=activeMeta()?.duration||0;elapsed=Math.max(0,Math.min(duration,value));mixer?.setTime(elapsed);$('timeline').value=String(elapsed);$('time').textContent=`${elapsed.toFixed(2)} / ${duration.toFixed(2)} s`;}
function currentState(){return {...state,time:elapsed,exportRig:$('exportRig').checked};}
function frameModel(){if(!model)return;model.updateMatrixWorld(true);const box=new THREE.Box3();model.traverse(o=>{if(o.isMesh&&o.visible){if(o.isSkinnedMesh)o.computeBoundingBox();else o.geometry.computeBoundingBox();const bounds=(o.isSkinnedMesh?o.boundingBox:o.geometry.boundingBox).clone().applyMatrix4(o.matrixWorld);box.union(bounds);}});if(box.isEmpty())return;const center=box.getCenter(new THREE.Vector3());const size=box.getSize(new THREE.Vector3());const distance=Math.max(...size.toArray())*1.75;controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(distance*.35,distance*.15,distance));controls.update();}
function visibleParts(){if(!model)return;for(const part of meta.parts){const node=model.getObjectByName(part.name);if(node)node.visible=!state.hidden.includes(part.name);}}
function fillParts(){
  $('parts').replaceChildren();let last='';
  for(const part of meta.parts){
    if(part.slot!==last){const heading=document.createElement('div');heading.className='slot';heading.textContent=part.slot;$('parts').append(heading);last=part.slot;}
    const label=document.createElement('label');label.className='part';const input=document.createElement('input');input.type='checkbox';input.checked=!state.hidden.includes(part.name);
    input.onchange=()=>{state.hidden=input.checked?state.hidden.filter(n=>n!==part.name):[...state.hidden,part.name];visibleParts();};
    const text=document.createElement('span');text.textContent=part.name.replace(part.slot+'_','').replace('_bmn_','_').replaceAll('_',' ');text.title=part.name;label.append(input,text);$('parts').append(label);
  }
}
function configureSaberMaterials(root,details=[]){
 const records=new Map(details.map(m=>[m.name,m]));
 root.traverse(o=>{if(!o.isMesh)return;const array=Array.isArray(o.material);const materials=array?o.material:[o.material];const converted=materials.map(m=>records.get(m.name)?.saberFX?saberFXMaterial(m,records.get(m.name)):m.name.startsWith('Saber ')?saberMaterial(m):m);o.material=array?converted:converted[0];const fx=records.get(materials[0]?.name)?.saberFX;if(fx)o.renderOrder=fx.channel==='core'?1:2;});
}
function dispose(root){const textures=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);for(const u of Object.values(m.uniforms||{}))if(u.value?.isTexture)textures.add(u.value);m.dispose();}for(const t of textures){t.dispose();t.image?.close?.();}}
async function load(next){
  if(busy)return false;
  lock(true);playing=false;$('play').textContent='Play';status('Loading native clip…');
  try{
    const newCatalog=await api.catalog(next.designer?.body||next.appearance?.body||'bmn');
    const result=await api.preview(next);
    const bytes=result.bytes;const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
    const manager=new THREE.LoadingManager();const failed=[];manager.onError=url=>failed.push(url);
    const gltf=await new GLTFLoader(manager).parseAsync(buffer,'');
    if(failed.length)throw Error(`Failed to load ${failed.length} embedded textures`);
    if(!gltf.animations.length)throw Error('Preview contains no animation');
    if(model){equipmentEditor.clear();scene.remove(model);mixer?.stopAllAction();dispose(model);}
    model=gltf.scene;configureSaberMaterials(model,result.materialDetails);model.scale.setScalar(10);model.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(model);model.position.y-=box.min.y;scene.add(model);
    mixer=new THREE.AnimationMixer(model);gltf.animations.forEach(clip=>mixer.clipAction(clip).play());
    catalog=newCatalog;if(result.clips)catalog.clips=result.clips;meta=result;state={...(result.state||next),appearance:result.appearance,hidden:[...next.hidden]};$('timeline').max=String(meta.duration);$('rootMotion').checked=state.rootMotion;$('exportRig').checked=state.exportRig!==false;
    $('clipTitle').textContent=(state.clip||'Rest pose').replace('.jba','').replaceAll('_',' ');
    visibleParts();fillParts();seek(state.time);frameModel();renderClips();
    if(state.version!==2)syncDesigner();await designerUI.sync(state,meta.parts);$('nativeWarnings').textContent=(result.warnings||[]).join('\n');$('nativeWarnings').hidden=!result.warnings?.length;$('legacyDesigner').hidden=state.version===2;$('gear').replaceChildren();$('gear').textContent=state.designer?.sourceNpc?'Customized NPC appearance':state.version===2?'Unequipped base + equipment layers':'Base outfit + independent equipment layers';$('materialNote').textContent='Baked SWTOR materials · 512 px';
    $('profileInfo').textContent=meta.profile+' · '+meta.boneCount+' bones';$('sockets').textContent=meta.sockets.join(' · ');
    model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.wireframe=wire;});
    status(`Ready · ${meta.parts.length} parts · ${meta.frames} frames · native animation`);return true;
  }catch(error){status(error.message);$('rootMotion').checked=state?.rootMotion||false;return false;}
  finally{lock(false);refreshEquipment();}
}
const colorFields=[['hairColor','Hair color','hairHue','#40291C'],['eyeColor','Eye color','eyeHue','#668571'],['gearColor','Outfit primary color','gearHue','#865331']];
for(const [id,label,legacy,fallback] of colorFields){
  const row=document.createElement('label');row.htmlFor=id;row.textContent=label;
  const group=document.createElement('div');group.className='colorControl';
  const picker=document.createElement('input');picker.type='color';picker.id=id;picker.value=fallback;picker.setAttribute('aria-label',label+' picker');
  const hex=document.createElement('input');hex.type='text';hex.id=id+'Hex';hex.maxLength=7;hex.placeholder='#RRGGBB';hex.setAttribute('aria-label',label+' hex code');
  const reset=document.createElement('button');reset.textContent='Reset';reset.title='Restore original '+label.toLowerCase();
  const change=value=>{try{hexToHsl(value);draft[id]=value.toUpperCase();draft[legacy]=null;picker.value=value;hex.value=draft[id];hex.setCustomValidity('');}catch(e){hex.setCustomValidity(e.message);hex.reportValidity();}};
  picker.oninput=()=>change(picker.value);hex.onchange=()=>change(hex.value.startsWith('#')?hex.value:'#'+hex.value);
  reset.onclick=()=>{draft[id]=null;draft[legacy]=null;picker.value=fallback;hex.value='';hex.placeholder='Original';hex.setCustomValidity('');};
  group.append(picker,hex,reset);$('paletteControls').append(row,group);
}
const paletteFields=[['skinBrightness','Skin brightness',-.3,.5,.3591]];
for(const [id,label,min,max,value] of paletteFields){
  const row=document.createElement('label');row.className='sliderLabel';row.htmlFor=id;row.append(label);const output=document.createElement('output');output.id=id+'Value';row.append(output);
  const input=document.createElement('input');input.id=id;input.type='range';input.min=min;input.max=max;input.step=.01;input.value=value;
  input.oninput=()=>{draft[id]=Number(input.value);output.textContent=input.value;};$('paletteControls').append(row,input);
}
function draftProfile(){return catalog.profiles.find(p=>p.gender===$('gender').value&&p.bodyType===Number($('bodyType').value));}
function choiceControls(){
  const p=draftProfile();draft.body=p.id;$('bodyValue').textContent=p.bodyType;
  for(const [key,values] of [['head',p.heads],['hair',p.hairs]]){
    if(!values.includes(draft[key]))draft[key]=values.includes(key==='head'?6:5)?key==='head'?6:5:values[0];
    const slider=$(key+'Choice');slider.max=values.length-1;slider.value=values.indexOf(draft[key]);$(key+'Value').textContent=draft[key];
  }
}
function syncDesigner(){
  draft={...state.appearance};const p=catalog.profiles.find(p=>p.id===draft.body);$('gender').value=p.gender;$('bodyType').value=p.bodyType;choiceControls();
  for(const [id,,, ,fallback] of paletteFields){$(id).value=draft[id]??fallback;$(id+'Value').textContent=draft[id]===null?'Original':String(draft[id]);}
  for(const [id,,legacy,fallback] of colorFields){const value=draft[id]??(draft[legacy]!==null?hueToHex(draft[legacy]):null);$(id).value=value||fallback;$(id+'Hex').value=value||'';$(id+'Hex').placeholder='Original';$(id+'Hex').setCustomValidity('');}
}
$('gender').onchange=choiceControls;$('bodyType').oninput=choiceControls;
for(const key of ['head','hair'])$(key+'Choice').oninput=()=>{draft[key]=draftProfile()[key==='head'?'heads':'hairs'][Number($(key+'Choice').value)];$(key+'Value').textContent=draft[key];};
$('applyAppearance').onclick=()=>{
  for(const [id] of colorFields)if(!$(id+'Hex').checkValidity()){$(id+'Hex').reportValidity();return false;}
  const bodyChanged=draft.body!==state.appearance.body;
  return load({...currentState(),appearance:{...draft},...(bodyChanged?{hidden:[],time:0,clip:catalog.defaultState.clip}:{})});
};
$('resetAppearance').onclick=()=>load({...currentState(),appearance:{...catalog.defaultState.appearance},hidden:[],time:0,clip:catalog.defaultState.clip});
async function switchWorkspace(next){
  if(busy||next===workspace)return;if(workspace==='designer')state.time=elapsed;playing=false;$('play').textContent='Play';workspace=next;
  document.body.dataset.workspace=next;const browser=next!=='designer';characterAnimation.hidden=browser;browserAnimation.hidden=!browser;designerAnimationSettings.hidden=browser;equipmentClose.onclick();for(const id of ['characterLibrary','designerPanel'])$(id).hidden=browser;$('assetLibrary').hidden=next!=='browser';$('npcLibrary').hidden=next!=='npc';$('assetPanel').hidden=!browser;
  $('resourceKind').textContent=next==='npc'?'NPC BROWSER':'ASSET BROWSER';$('resourceHeading').textContent=next==='npc'?'Character details':'Resource details';$('resourceHelp').textContent=next==='npc'?'Choose a character variant, select an animation, then export the current pose.':'Names here are resource filenames. Use NPC Browser to look up named characters.';$('assetMaterialControls').hidden=next==='npc';
  $('designerTab').classList.toggle('selected',!browser);$('browserTab').classList.toggle('selected',next==='browser');$('npcTab').classList.toggle('selected',next==='npc');lock(false);
  if(browser){if(model){equipmentEditor.clear();scene.remove(model);mixer?.stopAllAction();dispose(model);}model=null;mixer=null;assetMeta=null;seek(0);$('clipTitle').textContent='Choose a resource';$('materialNote').textContent='Textures and animations from local assets';$('assetAnimationSearch').value='';renderAssetClips();$('assetDetails').textContent='Choose a '+(next==='npc'?'character':'resource');$('assetNotes').textContent='';lock(false);if(next==='browser')await searchAssets();else await searchNpcs();}else await load({...state,time:state.time});refreshExpressions();
}
$('designerTab').onclick=()=>switchWorkspace('designer');$('browserTab').onclick=()=>switchWorkspace('browser');$('npcTab').onclick=()=>switchWorkspace('npc');
$('npcToDesigner').onclick=async()=>{
  if(busy||!assetMeta)return;const source=assetMeta,time=elapsed;lock(true);
  try{
    const imported=await api.importNpc(source.id);
    state={...catalog.defaultState,version:2,character:'native-designer',designer:imported.designer,appearance:{body:imported.designer.body},clip:source.clip,expression:source.expression||null,time,equipment:structuredClone(source.equipment||[]),hidden:[]};
    lock(false);await switchWorkspace('designer');
  }catch(e){status(e.message);lock(false);}
};
let npcSearchSequence=0,npcOffset=0,npcTotal=0;
async function searchNpcs(){
  const seq=++npcSearchSequence;$('npcCount').textContent='Reading local NPC catalog...';
  try{
    const result=await api.npcs({query:$('npcSearch').value,offset:npcOffset});if(seq!==npcSearchSequence)return;
    npcTotal=result.total;
    $('npcCount').textContent=`${result.total.toLocaleString()} results / ${result.indexed.toLocaleString()} local variants`;
    $('npcPrevious').disabled=npcOffset===0;$('npcNext').disabled=npcOffset+80>=npcTotal;
    $('npcItems').replaceChildren();
    for(const npc of result.items){
      const button=document.createElement('button');button.className='clip';
      const name=document.createElement('span');name.className='assetName';name.textContent=npc.name;
      const detail=document.createElement('span');detail.className='assetMeta';detail.textContent=`Level ${npc.level} / ${npc.body||'unresolved'} / variant ${npc.variant}`+(npc.ready?'':' / unavailable');
      button.title=npc.fqn+(npc.error?' / '+npc.error:'');button.append(name,detail);
      button.onclick=async()=>{if(await loadAsset(npc)){for(const item of $('npcItems').children)item.classList.remove('active');button.classList.add('active');}};$('npcItems').append(button);
    }
  }catch(e){if(seq===npcSearchSequence)$('npcCount').textContent=e.message;}
}
$('npcSearchForm').onsubmit=async event=>{event?.preventDefault();npcOffset=0;await searchNpcs();};
$('npcPrevious').onclick=()=>{npcOffset=Math.max(0,npcOffset-80);searchNpcs();};
$('npcNext').onclick=()=>{npcOffset+=80;searchNpcs();};
async function searchAssets(){
  const seq=++searchSequence;
  $('assetCount').textContent='Reading the local model index…';
  try{
    const found=await api.assets({query:$('assetSearch').value,category:$('assetCategory').value,offset:assetOffset});if(seq!==searchSequence)return;
    assetTotal=found.total;
    if($('assetCategory').options.length===1)for(const category of found.categories){const option=new Option(category,category);$('assetCategory').add(option);}
    $('assetCount').textContent=`${found.total.toLocaleString()} matches · ${found.indexed.toLocaleString()} indexed`;$('assetItems').replaceChildren();
    for(const asset of found.items){const button=document.createElement('button');button.className='clip';const name=document.createElement('span');name.className='assetName';name.textContent=asset.name;button.title=asset.id+(asset.aliases?.length?'\nKnown in-game names: '+asset.aliases.slice(0,20).join(', '):'');const meta=document.createElement('span');meta.className='assetMeta';meta.textContent=asset.category+(asset.body?' · '+asset.body:'')+(asset.aliases?.length>1?' · '+asset.aliases.length+' names':'');button.append(name,meta);button.onclick=()=>loadAsset(asset);$('assetItems').append(button);}
    $('assetPrevious').disabled=assetOffset===0;$('assetNext').disabled=assetOffset+80>=assetTotal;
  }catch(e){status(e.message);}
}
async function loadAsset(asset,selection={}){
  if(busy)return false;lock(true);status('Loading resource geometry…');
  try{
    const npc=workspace==='npc';
    if(npc&&selection.expression===undefined&&assetMeta?.id===asset.id)selection.expression=assetMeta.expression||null;
    if(selection.equipment===undefined&&assetMeta?.id===asset.id)selection.equipment=assetMeta.equipment||[];
    const result=npc?await api.previewNpc(asset.id,selection):await api.previewAsset(asset.id,selection),bytes=result.bytes;
    result.materials??=[];result.material??=null;
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    if(model){equipmentEditor.clear();scene.remove(model);mixer?.stopAllAction();dispose(model);}mixer=null;model=gltf.scene;configureSaberMaterials(model,result.materialDetails);
    const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());model.scale.setScalar(2/Math.max(...size.toArray(),.00001));model.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(model);const center=box.getCenter(new THREE.Vector3());model.position.set(-center.x,-box.min.y,-center.z);scene.add(model);frameModel();
    assetMeta=result;if(gltf.animations.length){mixer=new THREE.AnimationMixer(model);gltf.animations.forEach(clip=>mixer.clipAction(clip).play());}
    model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.wireframe=wire;});
    $('timeline').max=String(result.duration);seek(0);playing=false;$('play').textContent='Play';
    renderAssetClips();
    $('assetMaterial').replaceChildren(new Option('Model default',''));for(const material of result.materials)$('assetMaterial').add(new Option(material.split('/').at(-1).replace('.mat',''),material));$('assetMaterial').value=result.material||'';
    $('assetNotes').textContent=[...(!npc&&result.aliases?.length>1?['This mesh is shared by '+result.aliases.length+' in-game names. Choose a texture variant for the appearance you want.']:[]),result.clips.length?`${result.clips.length} associated animations · ${result.clips.length-result.unsupportedClips.length} playable${result.unsupportedClips.length?' · '+result.unsupportedClips.length+' mappings pending':''}`:'No associated animation library found',...result.warnings].join('\n');
    $('clipTitle').textContent=asset.name||result.name;$('clipTitle').title=asset.id;$('materialNote').textContent=(npc||result.texturedMaterials)?'Native materials · '+(result.clip?result.clip.replace('.jba',''):'rest pose'):'Geometry preview · material unavailable';$('assetDetails').textContent=(npc?result.name+' / '+result.fqn:asset.id)+(result.profile?' · '+result.profile:'');status('Resource loaded'+(result.clip?' · native animation':''));return true;
  }catch(e){status(e.message);if(assetMeta){$('assetAnimation').value=assetMeta.clip||'';$('assetMaterial').value=assetMeta.material||'';}return false;}finally{lock(false);refreshEquipment();}
}
function matchingClips(clips,query){
  const normalize=value=>value.toLowerCase().replaceAll('_',' ').trim().replace(/\s+/g,' ');
  return clips.filter(name=>normalize(name).includes(normalize(query)));
}
function renderAssetClips(){
  const clips=assetMeta?.clips||[],selected=assetMeta?.clip||'';
  const matches=matchingClips(clips,$('assetAnimationSearch').value);
  const pinned=selected&&!matches.includes(selected);
  $('assetAnimation').replaceChildren(new Option('Rest pose',''));
  for(const clip of [...(pinned?[selected]:[]),...matches]){
    const pending=assetMeta.unsupportedClips.includes(clip);
    const option=new Option((pinned&&clip===selected?'Current · ':'')+clip.replace('.jba','').replaceAll('_',' ')+(pending?' · mapping pending':''),clip);
    option.disabled=pending;$('assetAnimation').add(option);
  }
  $('assetAnimation').value=selected;
  $('assetAnimationCount').textContent=`${matches.length.toLocaleString()} of ${clips.length.toLocaleString()} animations${pinned?' · current animation kept':''}`;
}
$('assetAnimationSearch').oninput=renderAssetClips;
$('assetAnimation').onchange=()=>assetMeta&&loadAsset(assetMeta,{material:assetMeta.material,clip:$('assetAnimation').value||null});
$('assetMaterial').onchange=()=>assetMeta&&loadAsset(assetMeta,{material:$('assetMaterial').value||null,clip:assetMeta.clip});
let searchTimer;$('assetSearch').oninput=()=>{clearTimeout(searchTimer);assetOffset=0;searchTimer=setTimeout(searchAssets,200);};$('assetCategory').onchange=()=>{assetOffset=0;searchAssets();};
$('assetPrevious').onclick=()=>{assetOffset=Math.max(0,assetOffset-80);searchAssets();};$('assetNext').onclick=()=>{assetOffset+=80;searchAssets();};
let clipOffset=0;
function renderClips(){
  const matches=matchingClips(catalog.clips,$('search').value);
  clipOffset=Math.min(clipOffset,Math.max(0,Math.ceil(matches.length/100)-1)*100);
  $('clipsPrevious').disabled=clipOffset===0;$('clipsNext').disabled=clipOffset+100>=matches.length;
  $('count').textContent=`${matches.length.toLocaleString()} clips · ${matches.length?clipOffset+1:0}–${Math.min(clipOffset+100,matches.length)} · page ${Math.floor(clipOffset/100)+1} of ${Math.max(1,Math.ceil(matches.length/100))}`;$('clips').replaceChildren();
  if(state?.version===2){const rest=document.createElement('button');rest.className='clip'+(state.clip===null?' active':'');rest.textContent='Rest pose';rest.onclick=()=>load({...state,clip:null,time:0});$('clips').append(rest);}
  for(const name of matches.slice(clipOffset,clipOffset+100)){const button=document.createElement('button');button.className='clip'+(name===state?.clip?' active':'');button.textContent=name.replace('.jba','').replaceAll('_',' ');button.title=name;button.onclick=()=>load({...state,clip:name,time:0});$('clips').append(button);}
}
$('search').oninput=()=>{clipOffset=0;renderClips();};
$('clipsPrevious').onclick=()=>{clipOffset=Math.max(0,clipOffset-100);renderClips();$('clips').scrollTop=0;};
$('clipsNext').onclick=()=>{clipOffset+=100;renderClips();$('clips').scrollTop=0;};
$('play').onclick=()=>{if(!mixer)return;playing=!playing;$('play').textContent=playing?'Pause':'Play';};
$('timeline').oninput=event=>{playing=false;$('play').textContent='Play';seek(Number(event.target.value));};
$('frame').onclick=frameModel;
$('wire').onclick=()=>{wire=!wire;$('wire').setAttribute('aria-pressed',String(wire));model?.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.wireframe=wire;});};
$('rootMotion').onchange=()=>load({...currentState(),rootMotion:$('rootMotion').checked});

$('exportRig').onchange=()=>{state.exportRig=$('exportRig').checked;};
$('save').onclick=async()=>{try{const file=await api.save(currentState());if(file)status('Pose saved: '+file);}catch(e){status(e.message);}};
$('open').onclick=async()=>{try{const preset=await api.load();if(preset)await load(preset);}catch(e){status(e.message);}};
$('export').onclick=async()=>{lock(true);playing=false;$('play').textContent='Play';try{const file=workspace!=='designer'?(workspace==='npc'?await api.exportNpc(assetMeta.id,{expression:assetMeta.expression,clip:assetMeta.clip,time:elapsed,equipment:assetMeta.equipment||[],exportRig:$('assetExportRig').checked}):await api.exportAsset(assetMeta.id,{material:assetMeta.material,clip:assetMeta.clip,time:elapsed,equipment:assetMeta.equipment||[],exportRig:$('assetExportRig').checked})):await api.export(currentState());if(file)status('Posed FBX and materials saved: '+file);}catch(e){status(e.message);}finally{lock(false);refreshEquipment();}};
new ResizeObserver(()=>{const r=$('viewport').getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}).observe($('viewport'));
let previous=performance.now();
function animate(now){const dt=Math.min((now-previous)/1000,.1);previous=now;const duration=activeMeta()?.duration;if(playing&&duration)seek((elapsed+dt*Number($('speed').value))%duration);controls.update();updateSaberTime(scene,now/1000);renderer.render(scene,camera);requestAnimationFrame(animate);}requestAnimationFrame(animate);
try{
  catalog=await api.catalog();state=catalog.defaultState;
  if(catalog.smoke&&!catalog.smokeEquipment)state={...state,weapon:'blaster_high02_a03'};
  if(catalog.smokeBody)state={...state,appearance:{...state.appearance,body:catalog.smokeBody}};
  if(catalog.smokeHair)state={...state,clip:'am_env_idle_hot_02.jba',appearance:{...state.appearance,body:'bfn',hair:5}};
  for(const item of catalog.gear){const div=document.createElement('div');div.textContent=item.name;$('gear').append(div);}
  if(catalog.smokeNativePreset)state=catalog.smokeNativePreset;
  if(!catalog.smoke){const native=await api.designerOptions({species:'human',body:'bmn'});state={...state,version:2,character:'native-designer',designer:native.designer};}
  renderClips();const loaded=await load(state);
  if(catalog.smoke){
    if(!loaded)throw Error('Initial preview failed: '+$('status').textContent);
    if(catalog.smokeNativePreset){
      if(catalog.smokePikeUx){
 const handle=document.querySelector('.panelDivider'),before=document.querySelector('.library').clientWidth;
 handle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'}));await new Promise(r=>setTimeout(r,100));
 if(document.querySelector('.library').clientWidth<=before)throw Error('Panel did not resize');
 handle.dispatchEvent(new KeyboardEvent('keydown',{key:'Home'}));
 const labels=[...$('nativeChoices').querySelectorAll('option')].filter(o=>o.value);if(labels.some(o=>/^\d+$/.test(o.textContent)))throw Error('Unlabeled customization option');
 if(state.equipment[0].blade.spacing!==0)throw Error('Spacing default lost');
}
if(catalog.smokeExpression){
 if($('expressionSelect').options.length<20||state.expression!=='ad_face_joy_pose_01.jba')throw Error('Expression selector did not load');
 const clip=state.clip;seek(meta.duration*.5);const time=elapsed;
 $('expressionSelect').value='ad_face_anger_pose_01.jba';await $('expressionSelect').onchange();
 if(state.expression!=='ad_face_anger_pose_01.jba'||state.clip!==clip||Math.abs(elapsed-time)>.001)throw Error('Expression changed body animation or time');
 const head=model.getObjectByName('Head');
 if(head){head.getWorldPosition(controls.target);camera.position.copy(controls.target).add(new THREE.Vector3(0,.03,.65));controls.update();}
}
if(catalog.smokeStretch){
        const clip=state.clip,time=elapsed;$('search').value='2saber';$('search').oninput();const matches=matchingClips(catalog.clips,'2saber');if(matches.length<=100)throw Error('Pagination fixture too short');$('clipsNext').click();const titles=[...$('clips').children].map(n=>n.title).filter(Boolean);if(titles.join('|')!==matches.slice(100,200).join('|')||!$('clipsNext').disabled)throw Error('Second animation page incorrect');if(state.clip!==clip||elapsed!==time)throw Error('Paging changed playback');$('search').value='idle';$('search').oninput();if(!$('clipsPrevious').disabled)throw Error('Search did not reset paging');$('search').value='2saber';$('search').oninput();
      }

      if(catalog.smokeSaber){
        $('equipmentOpen').click();const inputs=[...$('equipmentLayers').querySelectorAll('input')];const toggle=inputs.find(i=>i.type==='checkbox'&&i.parentElement.textContent==='Blade on');if(!toggle)throw Error('Missing saber controls');toggle.checked=false;toggle.onchange();await $('equipmentApply').onclick();if(meta.parts.some(p=>p.name.includes('_blade_')))throw Error('Disabled blades still present');
        $('equipmentOpen').click();const on=[...$('equipmentLayers').querySelectorAll('input')].find(i=>i.type==='checkbox'&&i.parentElement.textContent==='Blade on');on.checked=true;on.onchange();const effect=$('equipmentLayers').querySelector('[aria-label="Blade effect"]');if(!effect)throw Error('Missing effect selector');effect.value='unstable';effect.onchange();await $('equipmentApply').onclick();if(state.equipment[0].blade.effect!=='unstable'||!meta.materialDetails.some(m=>m.saberEffect==='unstable'))throw Error('Effect selection was lost');if(!meta.parts.some(p=>p.name.includes('_blade_')))throw Error('Enabled blades missing');seek(.2);frameModel();
      }
      renderer.render(scene,camera);renderer.getContext().finish();await new Promise(r=>setTimeout(r,700));
      const bounds=new THREE.Box3().setFromObject(model);const diagnostics={camera:camera.position.toArray(),target:controls.target.toArray(),min:bounds.min.toArray(),max:bounds.max.toArray()};await api.smoke({ok:meta.parts.length>0&&Object.values(diagnostics).flat().every(Number.isFinite),diagnostics,designer:state.designer,parts:meta.parts.length,bones:meta.boneCount});
    }else if(catalog.smokeDesigner){
      await switchWorkspace('npc');
      if(!await loadAsset({id:'16141108995265840656-0'}))throw Error($('status').textContent);
      if(!assetMeta.parts.some(p=>p.slot==='facehair'))throw Error('NPC facial hair is absent');
      await $('npcToDesigner').onclick();
      if(workspace!=='designer'||state.version!==2||!meta.parts.some(p=>p.slot==='facehair'))throw Error('NPC import lost facial hair');
      const unchanged=JSON.stringify(state.designer);
      const face=$('nativeChoices').querySelector('[data-slot="appSlotFaceHair"]');face.value='';face.onchange();
      if(!await $('nativeApply').onclick())throw Error($('status').textContent);
      if(meta.parts.some(p=>p.slot==='facehair'))throw Error('Facial hair removal failed');
      state.designer=JSON.parse(unchanged);await load(state);
      const loadedOptions=$('nativeSpecies').options.length;
      const names=await api.equipment({query:'Ablative Resinite Armor Set'});
      if(!names.items.some(i=>i.name.includes('Ablative Resinite')))throw Error('Named outfit search failed');
      $('equipmentOpen').onclick();$('equipmentSearch').value='Ablative Resinite Vest';$('equipmentSearch').oninput();
      await new Promise(r=>setTimeout(r,600));
      const item=[...$('equipmentResults').children].find(b=>b.textContent.startsWith('Ablative Resinite Vest'));if(!item)throw Error('Named vest absent from UI');item.click();
      const layer=$('equipmentLayers').lastElementChild;
      const replacement=layer.querySelector('input[type=checkbox]');replacement.checked=false;replacement.onchange();
      const componentGroup=[...layer.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent==='Included components');if(!componentGroup)throw Error('Missing component controls');
      for(const input of componentGroup.querySelectorAll('input[type=checkbox]'))if(!input.parentElement.textContent.includes('collar')){input.checked=false;input.onchange();}
      const hex=layer.querySelector('.colorControl input[type=text]');hex.value='#217834';hex.onchange();
      await $('equipmentApply').onclick();
      if($('equipmentDialog').open||state.equipment.length!==1||state.equipment[0].components.length!==1||state.equipment[0].replaceSlot!==false||state.equipment[0].colors['*'].primary!=='#217834')throw Error('Equipment component/color UI failed');
      renderer.render(scene,camera);renderer.getContext().finish();await new Promise(r=>setTimeout(r,700));
      await api.smoke({ok:true,equipmentComponentControls:true,equipmentColorControls:true,npcImport:true,facialHairPreserved:true,facialHairRemoval:true,speciesVariants:loadedOptions,namedOutfitMatches:names.total,parts:meta.parts});
    }else if(catalog.smokeEmitters){
      for(const enabled of [true,false]){
        const equipment=[{item:'e2a74afd23102a22713a60f6',bone:'RightWeapon',position:[0,0,0],rotation:[0,0,0],scale:1,blade:{enabled}}];
        if(!await load({...currentState(),equipment}))throw Error($('status').textContent);
        equipmentEditor.select(0);
        const record=equipmentEditor.active,parts=meta.parts.filter(p=>p.equipmentLayer===0);
        if(record.meshes.length!==parts.length)throw Error('Equipment piece missing from live hilt: '+record.meshes.length+'/'+parts.length);
        const emitters=record.meshes.filter(m=>m.name.includes('emitter'));
        if(emitters.length!==2)throw Error('Expected both physical emitter pieces');
        equipmentEditor.apply({...state.equipment[0],position:[17,-9,8],rotation:[24,37,-18],scale:.8});
        seek(meta.duration*.4);model.updateMatrixWorld(true);
        if(emitters.some(m=>m.parent!==record.proxy||!m.visible))throw Error('Detached emitter');
        if(record.meshes.filter(m=>m.name.includes('_blade_')).length!==(enabled?6:0))throw Error('Blade toggle mismatch');
      }
      await api.smoke({ok:true,physicalEmitters:2,allPartsFollowHilt:true,bladesOnAndOff:true});
    }else if(catalog.smokeGizmo){
      await switchWorkspace('npc');
      const id='16140997066546414043-0',equipment=[{item:'2607262c6d3f559390a093ea',bone:'RightWeapon',position:[0,0,0],rotation:[0,0,0],scale:1}];
      if(!await loadAsset({id},{clip:'am_rifle_prone_idle.jba',equipment}))throw Error($('status').textContent);
      seek(assetMeta.duration*.4);model.updateMatrixWorld(true);
      const frame=model.getObjectByName('equipment_socket_0');
      const barrel=new THREE.Vector3(0,0,-1).transformDirection(frame.matrixWorld);
      if(Math.abs(barrel.y)>.3)throw Error('Prone rifle barrel is not horizontal: '+barrel.y);
      equipmentEditor.select(0);equipmentEditor.mode('rotate');
      // Exercise the TransformControls change path with noncommuting rotations.
      equipmentEditor.gizmo.dispatchEvent({type:'dragging-changed',value:true});
      const proxy=equipmentEditor.active.proxy;proxy.position.set(.004,-.003,.006);proxy.quaternion.setFromEuler(new THREE.Euler(23*Math.PI/180,-31*Math.PI/180,47*Math.PI/180,'ZYX'));proxy.scale.setScalar(.85);
      equipmentEditor.gizmo.dispatchEvent({type:'objectChange'});equipmentEditor.gizmo.dispatchEvent({type:'dragging-changed',value:false});model.updateMatrixWorld(true);
      const changed=structuredClone(assetMeta.equipment);
      const originalTime=elapsed,mesh=equipmentEditor.active.meshes[0],inverse=new THREE.Matrix4().copy(frame.matrixWorld).invert();
      const points=[];for(let i=0;i<mesh.geometry.attributes.position.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse));
      const fresh=await api.previewNpc(id,{clip:assetMeta.clip,equipment:changed});const bytes=fresh.bytes;
      const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const freshMixer=new THREE.AnimationMixer(gltf.scene);gltf.animations.forEach(c=>freshMixer.clipAction(c).play());freshMixer.setTime(originalTime);gltf.scene.updateMatrixWorld(true);
      const freshMesh=gltf.scene.getObjectByName(mesh.name),freshFrame=gltf.scene.getObjectByName('equipment_socket_0'),inv=new THREE.Matrix4().copy(freshFrame.matrixWorld).invert();freshMesh.skeleton.update();
      const errors=[];for(let i=0;i<freshMesh.geometry.attributes.position.count;i+=31){const p=new THREE.Vector3().fromBufferAttribute(freshMesh.geometry.attributes.position,i);freshMesh.applyBoneTransform(i,p);p.applyMatrix4(freshMesh.matrixWorld).applyMatrix4(inv);errors.push(Math.sqrt(points.reduce((best,q)=>Math.min(best,p.distanceToSquared(q)),Infinity)));}
      const error=Math.max(...errors);if(error>1e-6)throw Error('Live/worker transform mismatch: '+error);dispose(gltf.scene);
      if(!await loadAsset({id},{clip:'am_rifle_prone_fire_01.jba',equipment:changed}))throw Error($('status').textContent);
      if(JSON.stringify(assetMeta.equipment)!==JSON.stringify(changed))throw Error('Animation switch discarded equipment edits');
      if(!await loadAsset({id},{clip:'am_rifle_prone_idle.jba',equipment:changed}))throw Error($('status').textContent);
      $('equipmentReset').click();if(assetMeta.equipment[0].scale!==1)throw Error('Reset failed');$('equipmentUndo').click();if(Math.abs(assetMeta.equipment[0].scale-.85)>1e-6)throw Error('Undo failed');
      $('equipmentReset').click();seek(originalTime);frameModel();equipmentEditor.mode('rotate');await new Promise(r=>setTimeout(r,500));
      $('equipmentOpen').click();
      const numbers=[...$('equipmentLayers').querySelectorAll('input[type=number]')];
      numbers[3].value='89.198280533';numbers[3].onchange();numbers[4].value='-2.917627966';numbers[4].onchange();numbers.at(-1).value='1';numbers.at(-1).onchange();
      if(numbers.some(n=>!n.checkValidity()))throw Error('Fractional transform or unit scale rejected by browser');
      await $('equipmentApply').onclick();if($('equipmentDialog').open)throw Error($('equipmentError').textContent);
      if(assetMeta.equipment[0].scale!==1||assetMeta.equipment[0].rotation[0]!==89.198280533)throw Error('Equipment dialog discarded exact numeric values');
      await api.smoke({ok:true,fractionalTransformsAndUnitScale:true,npc:id,clip:assetMeta.clip,barrel:barrel.toArray(),liveWorkerMaxError:error,adjustedEquipment:changed,animationSwitchPreserved:true,resetUndo:true});
    }
    if(catalog.smokeEquipment){
      $('equipmentOpen').click();
      async function add(query,bone){
        $('equipmentSearch').value=query;$('equipmentSearch').dispatchEvent(new Event('input'));
        await new Promise(r=>setTimeout(r,800));
        const button=$('equipmentResults').querySelector('button');if(!button)throw Error('No equipment results: '+query);button.click();
        const select=$('equipmentLayers').lastElementChild.querySelector('select');select.value=bone;select.dispatchEvent(new Event('change'));
      }
      await add('blaster_high02_a03.gr2','RightWeapon');
      await add('blaster_high02_a03.gr2','socket_saber_left');
      await add('mtx_veh_pl_mt_jetpack_01.gr2','vfx_jetpack_back');
      $('equipmentApply').click();
      while($('equipmentApply').disabled)await new Promise(r=>setTimeout(r,100));
      if($('equipmentDialog').open)throw Error($('equipmentError').textContent);
      if(state.equipment.length!==3)throw Error('Equipment layers were lost');
      const distances={};
      for(const part of meta.parts.filter(p=>p.equipmentItem)){
        const mesh=model.getObjectByName(part.name),bone=model.getObjectByName(part.bone);const samples=[];
        for(const t of [0,meta.duration*.5,meta.duration]){seek(t);model.updateMatrixWorld(true);mesh.skeleton?.update();const v=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,0);if(mesh.isSkinnedMesh)mesh.applyBoneTransform(0,v);v.applyMatrix4(mesh.matrixWorld);samples.push(v.distanceTo(bone.getWorldPosition(new THREE.Vector3())));}
        if(Math.max(...samples)-Math.min(...samples)>.00001)throw Error('Attachment drifts from socket: '+part.name);distances[part.name]=samples;
      }
      seek(meta.duration*.4);frameModel();camera.position.z=-camera.position.z;controls.update();await new Promise(r=>setTimeout(r,500));
      await api.smoke({ok:Object.keys(distances).length===3,equipment:state.equipment,distances,parts:meta.parts});
    }
    const originalClip=state.clip,originalTime=elapsed;
    for(const query of ['IDLE','idle hot','__no_such_animation__','']){
      $('search').value=query;$('search').oninput();
      const expected=matchingClips(catalog.clips,query).slice(0,100);
      if([...$('clips').children].map(n=>n.title).join('|')!==expected.join('|')||state.clip!==originalClip||elapsed!==originalTime)throw Error('Designer animation search changed playback or returned wrong clips');
    }
    if(catalog.smokeCustom){
      $('gender').value='female';$('gender').onchange();$('bodyType').value='2';$('bodyType').oninput();
      for(const [key,value] of [['head',3],['hair',12]]){
        $(key+'Choice').value=draftProfile()[key==='head'?'heads':'hairs'].indexOf(value);$(key+'Choice').oninput();
      }
      for(const [key,value] of [['hairColor','#482D18'],['eyeColor','#588099'],['gearColor','#8040C0']]){$(key+'Hex').value=value;$(key+'Hex').onchange();}
      $('skinBrightness').value=.2;$('skinBrightness').oninput();
      if(!await $('applyAppearance').onclick())throw Error('Custom appearance failed: '+$('status').textContent);
      if(state.appearance.body!=='bfn'||state.appearance.head!==3||state.appearance.hair!==12||state.appearance.gearColor!=='#8040C0')throw Error('Appearance controls did not apply');
    }
    if(catalog.smokeNpc){
      const id=catalog.smokeNpc;await switchWorkspace('npc');
      $('npcSearch').value=id==='16141165779735661825-0'?'aric jorgan':'malgus';await $('npcSearchForm').onsubmit();
      if(!$('npcItems').children.length)throw Error('NPC search returned no entries');
      if(!await loadAsset({id,name:id}))throw Error($('status').textContent);
      if(catalog.smokeExpression){
        $('expressionSelect').value='ad_face_anger_pose_01.jba';await $('expressionSelect').onchange();
        if(assetMeta.expression!=='ad_face_anger_pose_01.jba')throw Error('NPC expression selection failed');
      }
      const initialClip=assetMeta.clip;
      $('assetAnimation').value='';if(!await $('assetAnimation').onchange()||assetMeta.clip!==null||assetMeta.duration!==0)throw Error('NPC rest pose selection failed');
      const testClip=assetMeta.clips.includes('mv_walk_forward.jba')?'mv_walk_forward.jba':initialClip;
      $('assetAnimation').value=testClip;if(!await $('assetAnimation').onchange()||assetMeta.clip!==testClip)throw Error('NPC animation selection failed');
      const meshes=[];model.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
      const sample=()=>{model.updateMatrixWorld(true);return meshes.flatMap(mesh=>{mesh.skeleton.update();return [0,Math.floor(mesh.geometry.attributes.position.count/2)].map(i=>{const p=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);mesh.applyBoneTransform(i,p);return p.applyMatrix4(mesh.matrixWorld);});});};
      seek(0);const first=sample();seek(assetMeta.duration*.4);const motion=Math.max(0,...sample().map((p,i)=>p.distanceTo(first[i])));
      if(catalog.smokeExpression&&assetMeta.expression!=='ad_face_anger_pose_01.jba')throw Error('NPC expression lost on clip change');
      const selected=assetMeta.clip;$('assetAnimationSearch').value='IDLE';$('assetAnimationSearch').oninput();
      if($('assetAnimation').value!==selected)throw Error('NPC animation search lost current clip');
      renderer.render(scene,camera);renderer.getContext().finish();await new Promise(r=>setTimeout(r,700));
      await api.smoke({ok:meshes.length>0&&motion>0&&!$('export').disabled,npc:id,searchResults:$('npcItems').children.length,meshes:meshes.length,motion,clip:assetMeta.clip,parts:assetMeta.parts,materials:assetMeta.materialDetails.length,exportAvailable:!$('export').disabled});
    }else if(catalog.smokeBrowser){
      seek(.25);const savedDesigner=currentState();
      const query=catalog.smokeAsset?catalog.smokeAsset.id.split('/').at(-1).replace('.gr2',''):catalog.smokeWalker?'atst_walker_baron01':'blaster_high02_a03';
      const testClip=catalog.smokeAsset?.clip||'mv_walk_forward.jba';
      await switchWorkspace('browser');$('assetSearch').value=query;await searchAssets();
      const found=await api.assets({query});const asset=found.items.find(a=>a.fileName===query);
      if(!asset||![...$('assetItems').children].some(b=>b.title.startsWith(asset.id)&&b.querySelector('.assetName').textContent===asset.name))throw Error('Asset name or filename tooltip missing');
      const displayed=await loadAsset(asset);await new Promise(r=>setTimeout(r,700));
      if(catalog.smokeWalker){
        $('assetAnimation').value=testClip;if(!await $('assetAnimation').onchange())throw Error('Asset animation load failed: '+$('status').textContent);
        const selectedClip=assetMeta.clip,selectedTime=elapsed;
        for(const query of ['IDLE','walk forward','__no_such_animation__','']){
          $('assetAnimationSearch').value=query;$('assetAnimationSearch').oninput();
          const matches=matchingClips(assetMeta.clips,query);
          const expected=[...new Set(['',...(!matches.includes(selectedClip)?[selectedClip]:[]),...matches])];
          if([...$('assetAnimation').options].map(o=>o.value).join('|')!==expected.join('|')||$('assetAnimation').value!==selectedClip||assetMeta.clip!==selectedClip||elapsed!==selectedTime)throw Error('Asset animation search changed playback or returned wrong clips');
        }
        const skinned=[];model.traverse(o=>{if(o.isSkinnedMesh)skinned.push(o);});
        const sample=()=>{model.updateMatrixWorld(true);return skinned.flatMap(mesh=>{mesh.skeleton.update();const points=[],position=mesh.geometry.attributes.position;for(let i=0;i<position.count;i+=Math.max(1,Math.floor(position.count/64))){const p=new THREE.Vector3().fromBufferAttribute(position,i);mesh.applyBoneTransform(i,p);points.push(p.applyMatrix4(mesh.matrixWorld));}return points;});};
        seek(0);const first=sample();seek(assetMeta.duration*.37);const motion=Math.max(0,...sample().map((p,i)=>p.distanceTo(first[i])));
        const textured=skinned.every(mesh=>(Array.isArray(mesh.material)?mesh.material:[mesh.material]).every(m=>!!m.map));await new Promise(r=>setTimeout(r,700));
        await switchWorkspace('designer');const restored=elapsed===savedDesigner.time&&state.clip===savedDesigner.clip&&JSON.stringify(state.appearance)===JSON.stringify(savedDesigner.appearance);
        await switchWorkspace('browser');await loadAsset(asset,{clip:testClip});seek(assetMeta.duration*.37);await new Promise(r=>setTimeout(r,700));
        await api.smoke({ok:displayed&&textured&&motion>.000001&&!$('play').disabled&&!$('export').disabled&&restored,animationSearchVerified:true,resource:asset.id,textured,motion,exportAvailable:!$('export').disabled,designerStateRestored:restored,clips:assetMeta.clips.length,playableClips:assetMeta.clips.length-assetMeta.unsupportedClips.length,bones:assetMeta.boneCount,clip:assetMeta.clip});
      }else await api.smoke({ok:displayed&&!$('export').disabled&&found.total>0,indexed:found.indexed,resource:asset.id,geometryPreview:displayed});
    }else{
    let hairAnchorError=null;
    if(catalog.smokeHair){
      const head=model.getObjectByName('Head'),hair=[];model.traverse(o=>{if(o.isSkinnedMesh&&o.name.startsWith('hair_'))hair.push(o);});
      const points=()=>{model.updateMatrixWorld(true);const inverse=head.matrixWorld.clone().invert();return hair.flatMap(mesh=>{mesh.skeleton.update();return Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>{const p=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);mesh.applyBoneTransform(i,p);return p.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);});});};
      seek(0);const rest=points();hairAnchorError=0;
      for(const t of [1.89,4.7,8.8]){seek(t);const moved=points();hairAnchorError=Math.max(hairAnchorError,...moved.map((p,i)=>p.distanceTo(rest[i])));}
      if(hairAnchorError>.00001||meta.secondaryAttachments.length!==2)throw Error('Hair separated from head: '+hairAnchorError);
    }
    seek(0);model.updateMatrixWorld(true);const wrist=model.getObjectByName('RightWrist');const start=wrist?.getWorldPosition(new THREE.Vector3());
    seek(meta.duration/2);model.updateMatrixWorld(true);const boneMotion=wrist&&start?wrist.getWorldPosition(new THREE.Vector3()).distanceTo(start):0;
    let meshes=0,skinned=0,textured=0;model.traverse(o=>{if(o.isMesh){meshes++;if((Array.isArray(o.material)?o.material:[o.material]).every(m=>m.map?.image?.width>0&&m.normalMap?.image?.width>0))textured++;}if(o.isSkinnedMesh)skinned++;});
    const part=meta.parts[0].name;state.hidden=[part];visibleParts();let target=model.getObjectByName(part);const visibilityWorked=target?.visible===false;state.hidden=[];visibleParts();
    const weapon=model.getObjectByName('blaster_high02_a03'),socket=model.getObjectByName('RightWeapon');
    const socketDistances=[];
    for(const t of [0,meta.duration*.5,meta.duration*.98]){
      seek(t);model.updateMatrixWorld(true);weapon?.skeleton?.update();
      if(weapon?.isSkinnedMesh&&socket){const point=new THREE.Vector3().fromBufferAttribute(weapon.geometry.attributes.position,0);weapon.applyBoneTransform(0,point);point.applyMatrix4(weapon.matrixWorld);socketDistances.push(point.distanceTo(socket.getWorldPosition(new THREE.Vector3())));}
    }
    const weaponFollows=socketDistances.length===3&&Math.max(...socketDistances)-Math.min(...socketDistances)<.00001;
    if(catalog.smokeDetail&&socket){const grip=socket.getWorldPosition(new THREE.Vector3());controls.target.copy(grip);camera.position.copy(grip).add(new THREE.Vector3(-.55,.22,.65));controls.update();}
    if(catalog.smokeHair)seek(1.89);
    await new Promise(resolve=>setTimeout(resolve,700));
    await api.smoke({ok:meshes>0&&textured===meshes&&skinned>0&&visibilityWorked&&boneMotion>0.00001&&weaponFollows,profile:meta.profile,sourceAnimationProfile:meta.sourceAnimationProfile,appearance:state.appearance,meshes,skinned,textured,visibilityWorked,boneMotion,weaponFollows,socketDistances,hairAnchorError,secondaryAttachments:meta.secondaryAttachments,clip:state.clip,time:elapsed,parts:meta.parts.length});
    }
  }
}catch(error){status(error.message);if(catalog?.smoke)await api.smoke({ok:false,error:error.message});}

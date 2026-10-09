import {liveSaber,bindSaberMesh} from './live-saber.js';
import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
const rad=THREE.MathUtils.degToRad,deg=THREE.MathUtils.radToDeg;
// Blender XYZ applies X, then Y, then Z: Three's equivalent composition is ZYX.
export function equipmentMatrix(value){return new THREE.Matrix4().compose(new THREE.Vector3(...(value.position||[0,0,0])).multiplyScalar(.001),new THREE.Quaternion().setFromEuler(new THREE.Euler(...(value.rotation||[0,0,0]).map(rad),'ZYX')),new THREE.Vector3().setScalar(value.scale??1));}
export function liveEquipment({scene,camera,renderer,orbit,getContext,setEntry,pause,status,prepare}){
 const $=id=>document.getElementById(id),gizmo=new TransformControls(camera,renderer.domElement);scene.add(gizmo.getHelper());gizmo.setSpace('local');gizmo.setSize(.8);
 let root=null,records=new Map(),active=null,undo=[],dragStart=null,enabled=false,locked=false;
 const blades=liveSaber({scene,camera,renderer,orbit,getEntry:i=>getContext().equipment[i],commit:apply,remember,pause,hideEquipment:()=>{enabled=false;gizmo.detach();},prepare,status});
 const fields=[];
 for(const [key,label] of [['position','Position (cm)'],['rotation','Rotation (degrees)'],['scale','Scale']]){
  const title=document.createElement('label');title.textContent=label;$('equipmentLiveNumbers').append(title);
  const row=document.createElement('div');row.className='equipmentVector';
  for(let axis=0;axis<(key==='scale'?1:3);axis++){
   const input=document.createElement('input');input.type='number';input.step='any';input.setAttribute('aria-label',label+(key==='scale'?'':' '+'XYZ'[axis]));
   input.onchange=()=>{if(!active)return;const value=Number(input.value);if(!Number.isFinite(value)||(key==='scale'&&value<=0)){updateNumbers();return;}
    remember();const state=structuredClone(getContext().equipment[active.index]);if(key==='scale')state.scale=value;else state[key][axis]=value;apply(state);};row.append(input);fields.push({input,key,axis});
  }$('equipmentLiveNumbers').append(row);
 }
 function updateNumbers(){if(!active)return;const r=getContext().equipment[active.index];if(!r)return;for(const {input,key,axis} of fields)input.value=String(Number((key==='scale'?r.scale:r[key][axis]).toFixed(5)));$('equipmentUndo').disabled=!undo.length;}
 function remember(){if(active){undo.push({index:active.index,value:structuredClone(getContext().equipment[active.index])});if(undo.length>100)undo.shift();}}
 function setProxy(value){equipmentMatrix(value).decompose(active.proxy.position,active.proxy.quaternion,active.proxy.scale);active.proxy.updateWorldMatrix(true,true);for(const blade of active.blades)blade.update(value.blade);blades.sync();}
 function apply(value){if(!active)return;setEntry(active.index,value);setProxy(value);updateNumbers();status('Equipment adjusted live · included in saves and FBX export');}
 function select(index){blades.detach();active=records.get(Number(index))||null;gizmo.detach();if(active){$('equipmentActive').value=String(active.index);if(enabled)gizmo.attach(active.proxy);updateNumbers();}blades.select(active);}
 gizmo.addEventListener('dragging-changed',event=>{orbit.enabled=!event.value;if(event.value){pause();dragStart=active?{index:active.index,value:structuredClone(getContext().equipment[active.index])}:null;}else if(dragStart){undo.push(dragStart);dragStart=null;updateNumbers();}});
 gizmo.addEventListener('objectChange',()=>{if(!active)return;const e=new THREE.Euler().setFromQuaternion(active.proxy.quaternion,'ZYX'),r=structuredClone(getContext().equipment[active.index]);r.position=active.proxy.position.toArray().map(v=>v*1000);r.rotation=[e.x,e.y,e.z].map(deg);r.scale=active.proxy.scale.x;setEntry(active.index,r);updateNumbers();});
 $('equipmentActive').onchange=()=>select($('equipmentActive').value);
 function mode(value){blades.detach();enabled=true;gizmo.setMode(value);if(active)gizmo.attach(active.proxy);$('equipmentMove').classList.toggle('selected',value==='translate');$('equipmentRotate').classList.toggle('selected',value==='rotate');}
 $('equipmentMove').onclick=()=>mode('translate');$('equipmentRotate').onclick=()=>mode('rotate');$('equipmentGizmoOff').onclick=()=>{enabled=false;gizmo.detach();};
 $('equipmentReset').onclick=()=>{if(!active)return;remember();apply({...getContext().equipment[active.index],position:[0,0,0],rotation:[0,0,0],scale:1});};
 $('equipmentUndo').onclick=()=>{const previous=undo.pop();if(previous){select(previous.index);apply(previous.value);}};
 function clear(){blades.select(null);dragStart=null;gizmo.detach();orbit.enabled=true;root=null;records=new Map();active=null;undo=[];$('equipmentLive').hidden=true;}
 function bind(model,meta){
  if(root===model)return;if(!model){clear();return;}clear();root=model;root.updateMatrixWorld(true);
  const entries=getContext().equipment||[];
  for(const [index,value] of entries.entries()){
   if(value.bone==='@skin')continue;const frame=model.getObjectByName('equipment_socket_'+index);if(!frame)continue;
   const proxy=new THREE.Group();proxy.name='equipment_adjustment_'+index;equipmentMatrix(value).decompose(proxy.position,proxy.quaternion,proxy.scale);// glTF conjugates local transforms into Y-up. This child restores the
   // Blender/native socket axes so numeric offsets and gizmos use the same frame.
   const nativeFrame=new THREE.Group();nativeFrame.name='equipment_native_axes_'+index;nativeFrame.rotation.x=-Math.PI/2;frame.add(nativeFrame);nativeFrame.add(proxy);proxy.updateWorldMatrix(true,true);
   const original=[],bladeRecords=[];
   for(const part of meta.parts.filter(p=>p.equipmentLayer===index)){
    // GLTFLoader removes dots from Blender's duplicate names (.001).
    // The original name is retained in userData, including repeated emitters.
    let mesh=model.getObjectByName(part.name);
    if(!mesh)model.traverse(o=>{if(o.isSkinnedMesh&&o.userData.name===part.name)mesh=o;});
    if(!mesh?.isSkinnedMesh)continue;
    const boneIndex=mesh.skeleton.bones.findIndex(b=>b.name===value.bone);if(boneIndex<0)continue;
    // Recover the rigid geometry in the native socket frame, removing the baked
    // user offset once. Subsequent changes are ordinary local object transforms.
    const skin=new THREE.Matrix4().copy(mesh.bindMatrixInverse).multiply(mesh.skeleton.bones[boneIndex].matrixWorld).multiply(mesh.skeleton.boneInverses[boneIndex]).multiply(mesh.bindMatrix);
    const canonical=new THREE.Matrix4().copy(proxy.matrixWorld).invert().multiply(mesh.matrixWorld).multiply(skin);
    const geometry=mesh.geometry.clone().applyMatrix4(canonical);geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const rigid=new THREE.Mesh(geometry,mesh.material);rigid.name=mesh.name;rigid.renderOrder=mesh.renderOrder;rigid.visible=mesh.visible;rigid.userData.equipmentLayer=index;proxy.add(rigid);
    mesh.name+='_baked_source';mesh.visible=false;original.push(rigid);if(part.saberEdit){const blade=bindSaberMesh(rigid,part.saberEdit,value.blade);if(blade){bladeRecords.push(blade);blade.update(value.blade);}}
   }
   if(original.length)records.set(index,{index,proxy,meshes:original,blades:bladeRecords,saber:meta.parts.some(p=>p.equipmentLayer===index&&/(?:^|\/)(?:dual)?saber[^/]*\.gr2$/i.test(p.source||'')),dual:meta.parts.some(p=>p.equipmentLayer===index&&/(?:^|\/)dualsaber/.test(p.source||''))});
  }
  $('equipmentActive').replaceChildren();for(const [i] of records)$('equipmentActive').add(new Option((meta.equipmentLabels?.[entries[i].item]||'Equipment '+(i+1))+' · '+entries[i].bone,String(i)));
  $('equipmentLive').hidden=!records.size;if(records.size)select(records.keys().next().value);
 }
 // Clicking an attached mesh selects its handles; normal orbiting is unchanged.
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
 renderer.domElement.addEventListener('pointerdown',event=>{down=gizmo.axis||blades.gizmo.axis?null:[event.clientX,event.clientY];});
 renderer.domElement.addEventListener('pointerup',event=>{if(locked||!down||Math.hypot(event.clientX-down[0],event.clientY-down[1])>3||gizmo.dragging||blades.gizmo.dragging)return;const bounds=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects([...records.values()].flatMap(r=>r.meshes).filter(m=>m.visible),false)[0];if(hit){select(hit.object.userData.equipmentLayer);mode(gizmo.mode);}});
 function setBusy(value){locked=value;blades.setBusy(value);gizmo.enabled=!value;for(const element of $('equipmentLive').querySelectorAll('button,input,select'))element.disabled=value;if(!value)updateNumbers();}
 return {bind,clear,select,mode,apply,setBusy,get active(){return active;},gizmo,blades};
}

import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {editableBlade,saberGroups} from '../saber-layout.mjs';

const matrix=rows=>new THREE.Matrix4().set(...rows);
const offset=e=>new THREE.Matrix4().compose(new THREE.Vector3(...e.position).multiplyScalar(.001),new THREE.Quaternion().setFromEuler(new THREE.Euler(...e.rotation.map(THREE.MathUtils.degToRad),'ZYX')),new THREE.Vector3(1,1,1));
export function bindSaberMesh(mesh,edit,blade){
 const original=blade?.elements?.[edit.element];if(!original)return null;
 const frame=matrix(edit.frame),emitter=matrix(edit.matrix);
 mesh.geometry.applyMatrix4(emitter.clone().invert());
 const positions=mesh.geometry.attributes.position.array.slice();
 const initial=frame.clone().multiply(offset(original)).invert();
 mesh.matrixAutoUpdate=false;
 return {key:edit.element,mesh,frame,emitter,update(value){
  const element=value.elements[edit.element];
  mesh.matrix.copy(frame).multiply(offset(element)).multiply(initial).multiply(emitter);
  const attr=mesh.geometry.attributes.position,oldLength=edit.length*.001,newLength=element.length*.001;
  const oldRadius=edit.radius,newRadius=oldRadius?Math.min(element.width*.001*edit.radiusFactor,newLength/2)*edit.radiusScale:0;
  const oldTotal=oldLength+(edit.tipExtension?oldRadius:0),newTotal=newLength+(edit.tipExtension?newRadius:0);
  for(let i=0;i<attr.count;i++){
   let x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2];
   if(oldRadius){const upper=y>oldTotal/2;y=(y-(upper?oldTotal-oldRadius:oldRadius))*newRadius/oldRadius+(upper?newTotal-newRadius:newRadius);x*=newRadius/oldRadius;z*=newRadius/oldRadius;}
   else {y*=newLength/oldLength;x*=element.width/edit.width;z*=element.width/edit.width;}
   attr.setXYZ(i,x,y,z);
  }
  attr.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();mesh.updateMatrixWorld(true);
 }};
}

export function liveSaber({scene,camera,renderer,orbit,getEntry,commit,remember,pause,hideEquipment,prepare,status}){
 const panel=document.createElement('details');panel.id='liveSaber';panel.className='saberEditor';panel.open=true;panel.hidden=true;
 panel.innerHTML='<summary>Lightsaber · edit blades live</summary><select aria-label="Live saber element"></select><div class="gizmoModes"><button type="button">Move blades</button><button type="button">Drag length</button><button type="button">Drag thickness</button><button type="button">Hide blade gizmo</button></div><label>Length (cm)<input type="number" step="any" min="0.001" aria-label="Live blade length"></label><label>Position · X / Y / Z (cm)</label><div class="equipmentVector"></div><p class="muted">Select a blade or guard pair. Move its origin, or drag the length handle along the blade. Changes apply immediately.</p>';
 document.getElementById('equipmentActive').after(panel);
 const hiltLabel=document.createElement('label');hiltLabel.textContent='Whole attachment';hiltLabel.hidden=true;panel.after(hiltLabel);
 const thickness=document.createElement('label');thickness.textContent='Thickness (cm)';
 const thicknessInput=document.createElement('input');thicknessInput.type='number';thicknessInput.step='any';thicknessInput.min='.001';thicknessInput.setAttribute('aria-label','Live blade thickness');thickness.append(thicknessInput);panel.querySelector('label').after(thickness);
 const choose=panel.querySelector('select'),length=panel.querySelector('input'),width=panel.querySelector('[aria-label="Live blade thickness"]'),numbers=panel.querySelector('.equipmentVector'),buttons=panel.querySelectorAll('button');
 const inputs=Array.from({length:3},(_,axis)=>{const input=document.createElement('input');input.type='number';input.step='any';input.setAttribute('aria-label','Live blade position '+'XYZ'[axis]);numbers.append(input);return input;});
 const prepareButton=document.createElement('button');prepareButton.textContent='Prepare editable blades';panel.append(prepareButton);
 const help=panel.querySelector('p');
 const gizmo=new TransformControls(camera,renderer.domElement);gizmo.setMode('translate');gizmo.setSpace('local');gizmo.setSize(.7);scene.add(gizmo.getHelper());
 const anchor=new THREE.Group(),handle=new THREE.Group();anchor.add(handle);anchor.matrixAutoUpdate=false;
 let record=null,mode=null,locked=false,dragging=false;
 const keys=()=>choose.value==='straight'||choose.value==='diagonal'?[choose.value+'Left',choose.value+'Right']:[choose.value];
 const selected=()=>record?.blades.find(b=>b.key===keys()[0]);
 function detach(){gizmo.detach();mode=null;orbit.enabled=true;for(const button of buttons)button.classList.remove('selected');}
 function sync(){
  if(!record)return;const value=getEntry(record.index),element=value.blade?.elements?.[keys()[0]];if(!element)return;
  length.value=element.length;width.value=element.width;inputs.forEach((input,i)=>input.value=Number(element.position[i].toFixed(5)));
  if(dragging)return;const blade=selected();if(!blade)return;
  if(mode==='length'||mode==='width'){anchor.matrix.copy(blade.mesh.matrix);handle.position.set(mode==='width'?element.width*.0005:0,mode==='length'?element.length*.001:0,0);gizmo.showX=mode==='width';gizmo.showY=mode==='length';gizmo.showZ=false;}
  else {anchor.matrix.copy(blade.frame);handle.position.fromArray(element.position).multiplyScalar(.001);gizmo.showX=gizmo.showY=gizmo.showZ=true;}
  handle.quaternion.identity();handle.scale.setScalar(1);anchor.updateMatrixWorld(true);
 }
 function change(prop,value){
  if(!record||locked)return;const entry=structuredClone(getEntry(record.index));
  for(const key of keys())if(entry.blade.elements[key])entry.blade.elements[key][prop]=structuredClone(value);
  commit(entry);sync();status('Blade adjusted live · included in saves and FBX export');
 }
 inputs.forEach((input,axis)=>input.onchange=()=>{const n=Number(input.value);if(!input.value||!Number.isFinite(n)){sync();return;}remember();const pos=[...getEntry(record.index).blade.elements[keys()[0]].position];pos[axis]=n;change('position',pos);});
 length.onchange=()=>{const n=Number(length.value);if(!length.value||!Number.isFinite(n)||n<=0){sync();return;}remember();change('length',n);};
 width.onchange=()=>{const n=Number(width.value);if(!width.value||!Number.isFinite(n)||n<=0){sync();return;}remember();change('width',n);};
 function activate(next){if(locked||!selected())return;hideEquipment();mode=next;buttons.forEach((button,i)=>button.classList.toggle('selected',i===['move','length','width'].indexOf(next)));pause();sync();gizmo.attach(handle);}
 buttons[0].onclick=()=>activate('move');buttons[1].onclick=()=>activate('length');buttons[2].onclick=()=>activate('width');buttons[3].onclick=detach;
 choose.onchange=()=>{detach();sync();};panel.ontoggle=()=>{if(!panel.open)detach();};
 gizmo.addEventListener('dragging-changed',e=>{dragging=e.value;orbit.enabled=!e.value;if(e.value){pause();remember();}else sync();});
 gizmo.addEventListener('objectChange',()=>{if(!record||locked)return;if(mode==='length')change('length',Math.max(.001,handle.position.y*1000));else if(mode==='width')change('width',Math.max(.001,handle.position.x*2000));else change('position',handle.position.toArray().map(v=>v*1000));});
 prepareButton.onclick=async()=>{if(!record||locked)return;const value=structuredClone(getEntry(record.index));value.blade=editableBlade(value.blade??{enabled:true},record.dual);if(!value.blade.enabled){value.blade.layout.single=true;value.blade.enabled=true;}try{await prepare(record.index,value);}catch(e){status(e.message);}};
 function select(next){
  const previous=record?.index===next?.index?choose.value:null;
  detach();anchor.removeFromParent();record=next;panel.hidden=!record?.saber;hiltLabel.hidden=panel.hidden;if(panel.hidden)return;
  record.proxy.add(anchor);choose.replaceChildren();for(const [key,label] of saberGroups)if(record.blades.some(b=>b.key===(key==='straight'||key==='diagonal'?key+'Left':key)))choose.add(new Option(label,key));
  if(previous&&[...choose.options].some(option=>option.value===previous))choose.value=previous;
  const available=!!choose.options.length;prepareButton.hidden=available;choose.hidden=!available;length.parentElement.hidden=!available;width.parentElement.hidden=!available;numbers.hidden=!available;numbers.previousElementSibling.hidden=!available;buttons[0].parentElement.hidden=!available;
  help.textContent=available?'Move a blade or guard pair, or drag its length or thickness handle. Changes apply immediately and persist in saves and exports.':'Prepare an editable layout to adjust blades here. Existing native layouts become main/bottom blades; add crossguards in Equipment & attachments.';
  sync();setBusy(locked);
 }
 function setBusy(value){locked=value;gizmo.enabled=!value;for(const el of panel.querySelectorAll('button,input,select'))el.disabled=value;}
 return {select,sync,detach,setBusy,gizmo};
}

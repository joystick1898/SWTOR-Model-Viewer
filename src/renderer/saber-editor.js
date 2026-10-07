import {editableBlade,saberGroups,elementDefaults,saberEffects} from '../saber-layout.mjs';

export function saberEditor(layer,isDual){
 const legacy=Boolean(layer.blade&&!layer.blade.layout),blade=editableBlade(layer.blade,isDual);
 let edited=false;
 const commit=()=>{edited=true;layer.blade=blade;updateSummary();};
 const commitAppearance=()=>{
  if(legacy&&!edited){layer.blade={...layer.blade,effect:blade.effect??'native',motion:blade.motion??'static',frame:blade.frame??0};updateSummary();}
  else commit();
 };
 const group=document.createElement('details');group.className='saberEditor';
 const summary=document.createElement('summary');group.append(summary);
 const updateSummary=()=>{const active=saberGroups.filter(([key])=>blade.layout[key]);summary.textContent='Lightsaber blades · '+(legacy&&!edited?'saved native layout':active.length?active.map(([,label])=>label.replace(' (bottom)','')).join(', '):'off');};updateSummary();
 const toggles=document.createElement('div');toggles.className='saberToggles';group.append(toggles);
 for(const [key,title] of saberGroups){
  const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.checked=blade.layout[key];
  input.onchange=()=>{blade.layout[key]=input.checked;blade.enabled=Object.values(blade.layout).some(Boolean);commit();};label.append(input,document.createTextNode(title));toggles.append(label);
 }
 const help=document.createElement('p');help.className='muted';help.textContent='Combine any toggles, or turn all off. Dual Blade adds the bottom blade. Edit each blade or crossguard pair below, then Apply equipment.'+(legacy?' Editing a layout toggle or individual element replaces the saved native layout. Effect and motion controls preserve it.':'');group.append(help);
 const effectLabel=document.createElement('label');effectLabel.textContent='Effect · all elements';const effect=document.createElement('select');effect.setAttribute('aria-label','Blade effect');
 for(const [key,title] of saberEffects)effect.add(new Option(title,key));
 effect.value=blade.effect??'native';effect.onchange=()=>{blade.effect=effect.value;commitAppearance();};effectLabel.append(effect);group.append(effectLabel);
 const motionLabel=document.createElement('label');motionLabel.textContent='Blade motion';const motion=document.createElement('select');motion.setAttribute('aria-label','Blade motion');
 for(const [key,title] of [['static','Static frame'],['animated','Animated crackle']])motion.add(new Option(title,key));
 motion.value=blade.motion??'static';motion.onchange=()=>{blade.motion=motion.value;commitAppearance();};motionLabel.append(motion);group.append(motionLabel);
 const frameLabel=document.createElement('label');frameLabel.textContent='Texture frame / animation offset';const frame=document.createElement('input');frame.type='number';frame.required=true;frame.min='0';frame.max='1023';frame.step='1';frame.value=blade.frame??0;frame.setAttribute('aria-label','Blade texture frame');
 frame.oninput=()=>{const value=Number(frame.value);if(frame.value!==''&&frame.checkValidity()){blade.frame=value;commitAppearance();}};frameLabel.append(frame);group.append(frameLabel);
 const scope=document.createElement('p');scope.className='muted';scope.textContent='Persistent blade artwork only. No ignition, shutdown, swing trails or impacts. Animation uses native texture frames where available; static textures stay still.';group.append(scope);
 const editor=document.createElement('details');const editorTitle=document.createElement('summary');editorTitle.textContent='Edit individual elements';editor.append(editorTitle);
 const selection=document.createElement('select');selection.setAttribute('aria-label','Saber element');for(const [key,title] of saberGroups)selection.add(new Option(title,key));editor.append(selection);
 const fields=document.createElement('div');editor.append(fields);group.append(editor);
 function draw(){
  fields.replaceChildren();const selected=selection.value,pair=selected==='straight'||selected==='diagonal';
  const key=pair?selected+'Left':selected,element=blade.elements[key];
  const commitElement=()=>{if(pair)blade.elements[selected+'Right']=structuredClone(blade.elements[key]);commit();};
  for(const prop of ['core','glow']){
   const label=document.createElement('label');label.textContent=prop==='core'?'Core color':'Glow color';const row=document.createElement('div');row.className='colorControl';
   const picker=document.createElement('input');picker.type='color';picker.value=element[prop];picker.setAttribute('aria-label','Element '+prop+' color');
   const hex=document.createElement('input');hex.value=element[prop];hex.setAttribute('aria-label','Element '+prop+' hex');
   picker.oninput=()=>{element[prop]=picker.value;hex.value=picker.value;hex.setCustomValidity('');commitElement();};
   hex.onchange=()=>{const value=hex.value.startsWith('#')?hex.value:'#'+hex.value;hex.setCustomValidity(/^#[0-9a-f]{6}$/i.test(value)?'':'Use #RRGGBB');if(hex.checkValidity()){element[prop]=value.toLowerCase();picker.value=value;commitElement();}};
   row.append(picker,hex);fields.append(label,row);
  }
  const dimensions=document.createElement('div');dimensions.className='saberDimensions';fields.append(dimensions);
  for(const [prop,title] of [['length','Length (cm)'],['width','Thickness (cm)'],['intensity','Brightness']]){
   const label=document.createElement('label');label.textContent=title;const input=document.createElement('input');input.type='number';input.step='any';input.value=element[prop];input.setAttribute('aria-label','Element '+title);
   input.oninput=()=>{const value=Number(input.value);input.setCustomValidity(input.value!==''&&Number.isFinite(value)&&value>0?'':'Use a positive value');if(input.checkValidity()){element[prop]=value;commitElement();}};label.append(input);dimensions.append(label);
  }
  const placement=document.createElement('details');const title=document.createElement('summary');title.textContent='Position & direction';placement.append(title);
  const note=document.createElement('p');note.className='muted';note.textContent='Offsets from this element’s starting point. Y follows the main blade; Z is across the guards; X is depth. Crossguard controls move and rotate both sides together.';placement.append(note);
  for(const [prop,title,unit] of [['position','Position','cm'],['rotation','Rotation','degrees']]){
   const label=document.createElement('label');label.textContent=title+' · X / Y / Z ('+unit+')';placement.append(label);const row=document.createElement('div');row.className='equipmentVector';
   for(let axis=0;axis<3;axis++){
    const input=document.createElement('input');input.type='number';input.step='any';input.value=element[prop][axis];input.setAttribute('aria-label','Element '+title+' '+'XYZ'[axis]+' '+unit);
    input.oninput=()=>{const value=Number(input.value);input.setCustomValidity(input.value!==''&&Number.isFinite(value)?'':'Use a finite number');if(input.checkValidity()){element[prop][axis]=value;commitElement();}};row.append(input);
   }placement.append(row);
  }
  fields.append(placement);
  const reset=document.createElement('button');reset.type='button';reset.textContent='Reset this element';reset.onclick=()=>{blade.elements[key]=elementDefaults(blade,key);commitElement();draw();};fields.append(reset);
 }
 // Keep invalid edits visible until corrected; do not silently discard them by switching.
 let previous=selection.value;selection.onchange=()=>{const invalid=fields.querySelector('input:invalid');if(invalid){selection.value=previous;invalid.reportValidity();return;}previous=selection.value;draw();};draw();
 return group;
}

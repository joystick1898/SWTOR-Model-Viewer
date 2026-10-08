import {saberEditor} from './saber-editor.js';
import {colorMenu} from './color-menu.js';
import {equipmentSlots,equipmentSlot,reconcileEquipmentDraft} from './equipment-layout.mjs';
export function equipmentUI(api,getContext,apply){
 const $=id=>document.getElementById(id);let layers=[],names=new Map(),kinds=new Map(),models=new Map(),offset=0,total=0,sequence=0,bones=[],parts=[],selected=-1,targetSlot=null,replaceIndex=null,baseline='[]',contextKey=null,applying=false,locked=false;
 const dirty=()=>JSON.stringify(layers)!==baseline;
 let colorViews=new WeakMap(),origins=new WeakMap(),timer;
 function resetLayers(value){layers=structuredClone(value);origins=new WeakMap(layers.map((r,i)=>[r,i]));}
 function colorView(r,refresh){const views=colorViews.get(r)||[];views.push(refresh);colorViews.set(r,views);}
 function refreshColors(r){for(const refresh of colorViews.get(r)||[])refresh();pending();}
 function pending(){const changed=dirty();$('equipmentSummary').textContent=layers.length+' equipment layers'+(changed?' · Unapplied changes':'');$('equipmentRevert').disabled=locked||!changed;$('equipmentApply').disabled=locked||applying||!bones.length;for(const clear of $('equipmentSlots').querySelectorAll('.clearSlot'))clear.disabled=locked||applying;}
 function choose(index){selected=index;render();}
 function picker(slot=null,replacing=null){if(locked)return;clearTimeout(timer);targetSlot=slot;replaceIndex=replacing;offset=0;$('equipmentSearch').value='';$('equipmentCategory').value=equipmentSlots.some(([key])=>key===slot)?slot:'';document.querySelector('.library').dataset.picker='true';$('equipmentPicker').hidden=false;$('equipmentPickerTitle').textContent=slot?'Choose '+(equipmentSlots.find(([key])=>key===slot)?.[1]||'equipment'):'Find equipment';search();$('equipmentSearch').focus();}
 function closePicker(){clearTimeout(timer);delete document.querySelector('.library').dataset.picker;$('equipmentPicker').hidden=true;targetSlot=null;replaceIndex=null;sequence++;}
 function slotOf(r,i){return equipmentSlot(r,models.get(r.item)||[],parts.filter(p=>origins.has(r)&&p.equipmentLayer===origins.get(r)));}
 function dyeMenu(r,title){
  const sources=[['*','Whole item'],...[...new Set(models.get(r.item)||[])].map(source=>[source,source.split('/').at(-1).replace(/\.gr2$/i,'').replaceAll('_',' ')])];
  const groups=sources.map(([source,label])=>({label,channels:['primary','secondary'].map(channel=>({label:channel==='primary'?'Primary':'Secondary',value:r.colors?.[source]?.[channel],read:()=>r.colors?.[source]?.[channel]||null,change:value=>{r.colors??={};r.colors[source]??={};if(value)r.colors[source][channel]=value;else{delete r.colors[source][channel];if(!Object.keys(r.colors[source]).length)delete r.colors[source];if(!Object.keys(r.colors).length)delete r.colors;}}}))}));
  const menu=colorMenu(title,groups[0].channels,()=>refreshColors(r),groups);colorView(r,()=>menu.refresh());return menu;
 }
 function renderSlots(){
  $('equipmentSlots').replaceChildren();$('attachmentItems').replaceChildren();
  const slots=layers.map(slotOf);
  for(const [key,title] of equipmentSlots){
   const indices=layers.flatMap((r,i)=>slots[i]===key?[i]:[]),index=indices.includes(selected)?selected:indices.at(-1);
   const row=document.createElement('div');row.className='equipmentSlotRow';
   const label=document.createElement('span');label.className='slotLabel';label.textContent=title;
   const button=document.createElement('button');button.className='itemButton';button.textContent=index===undefined?'Choose item…':names.get(layers[index].item)||'Equipment '+(index+1);button.title=button.textContent;button.setAttribute('aria-label',title+' · '+button.textContent);button.disabled=locked||!bones.length;button.onclick=()=>index===undefined?picker(key):choose(index);button.classList.toggle('selected',index!==undefined&&selected===index);
   row.append(label,button);
   if(index!==undefined){row.classList.add('filled');row.append(dyeMenu(layers[index],title+' colors'));
    const clear=document.createElement('button');clear.type='button';clear.className='clearSlot';clear.setAttribute('aria-label','Clear '+title+' item');clear.title='Remove this item (Apply equipment to confirm)';clear.disabled=locked||applying;
    clear.onclick=()=>{if(locked||applying)return;closePicker();const selectedLayer=layers[selected];layers=layers.filter((_,i)=>slots[i]!==key);selected=layers.indexOf(selectedLayer);render();$('equipmentSlots').children[equipmentSlots.findIndex(([slot])=>slot===key)].querySelector('.itemButton').focus();};row.append(clear);
    if(indices.length>1){const select=document.createElement('select');select.setAttribute('aria-label',title+' layer');for(const i of indices)select.add(new Option((names.get(layers[i].item)||'Equipment')+' · layer '+(i+1),String(i)));select.value=String(index);select.onchange=()=>choose(Number(select.value));row.append(select);}}
   else{const blank=document.createElement('span');blank.className='emptySlot';blank.textContent='—';row.append(blank);}
   $('equipmentSlots').append(row);
  }
  const heading=document.createElement('h3');heading.textContent='Attachments';$('attachmentItems').append(heading);
  for(const [i,r] of layers.entries())if(!slots[i]){const row=document.createElement('div');row.className='attachmentRow appearanceControl';const button=document.createElement('button');button.textContent=names.get(r.item)||'Attachment '+(i+1);button.onclick=()=>choose(i);button.disabled=locked;button.classList.toggle('selected',i===selected);row.append(button,dyeMenu(r,button.textContent+' colors'));$('attachmentItems').append(row);}
  const add=document.createElement('button');add.textContent='Add attachment';add.disabled=locked||!bones.length;add.onclick=()=>picker();$('attachmentItems').append(add);
 }
 const labels={vfx_jetpack_back:'Jetpack / back',RightWeapon:'Right hand / two-handed grip',LeftWeapon:'Left hand',socket_saber_right:'Right hip / holster',socket_saber_left:'Left hip / holster',socket_weapon_back_right:'Back right',socket_weapon_back_left:'Back left',socket_weapon_back_left_upper:'Back upper left',Spine2:'Upper back / jetpack (Spine2)',Bip01_Spine2:'Upper back / jetpack'};
 function render(){
  colorViews=new WeakMap();
  selected=layers.length?Math.max(0,Math.min(selected,layers.length-1)):-1;renderSlots();
  $('equipmentSelected').textContent=selected>=0?'Selected item · '+(names.get(layers[selected].item)||'Equipment '+(selected+1)):'Select a slot or add an attachment';
  $('equipmentLayers').replaceChildren();
  layers.forEach((r,i)=>{
   const box=document.createElement('div');box.className='equipmentLayer';box.hidden=i!==selected;const name=document.createElement('strong');name.textContent=names.get(r.item)||r.item;box.append(name);
   const actions=document.createElement('div');actions.className='itemActions';const replace=document.createElement('button');replace.textContent='Replace item';replace.onclick=()=>picker(slotOf(r,i),i);const extra=document.createElement('button');extra.textContent='Add layer';extra.onclick=()=>picker(slotOf(r,i));actions.append(replace,extra);box.append(actions);
   const select=document.createElement('select');select.setAttribute('aria-label','Attachment bone for layer '+(i+1));
   if(kinds.get(r.item)==='armor'||r.bone==='@skin')select.add(new Option('Native clothing fit (replaces clothing slot)','@skin'));
   const ordered=[...Object.keys(labels).filter(b=>bones.includes(b)),...bones.filter(b=>!labels[b])];
   for(const b of ordered)select.add(new Option(labels[b]?labels[b]+' · '+b:b,b));
   if(r.bone!=='@skin'&&!bones.includes(r.bone))select.add(new Option('Unavailable: '+r.bone,r.bone));
   select.value=r.bone;select.onchange=()=>{r.bone=select.value;render();};box.append(select);
   if((models.get(r.item)||[]).some(p=>/(?:^|\/)(?:dual)?saber[^/]*\.gr2$/i.test(p))){
    box.append(saberEditor(r,(models.get(r.item)||[]).some(p=>/(?:^|\/)dualsaber/.test(p))));
   }
   const adjustments=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Adjust position, rotation & scale';adjustments.append(summary);
   for(const [key,label] of [['position','Position'],['rotation','Rotation']]){
    const title=document.createElement('label');title.textContent=label+' (X / Y / Z)';adjustments.append(title);const row=document.createElement('div');row.className='equipmentVector';
    for(let axis=0;axis<3;axis++){const input=document.createElement('input');input.type='number';input.step='any';input.value=r[key]?.[axis]??0;input.setAttribute('aria-label',label+' '+'XYZ'[axis]);input.disabled=r.bone==='@skin';input.onchange=()=>{r[key]??=[0,0,0];r[key][axis]=Number(input.value);};row.append(input);}adjustments.append(row);
   }
   const label=document.createElement('label');label.textContent='Scale ';const scale=document.createElement('input');scale.type='number';scale.step='any';scale.value=r.scale??1;scale.disabled=r.bone==='@skin';scale.onchange=()=>r.scale=Number(scale.value);label.append(scale);adjustments.append(label);if(r.bone!=='@skin')box.append(adjustments);
   if(r.bone==='@skin'){
    const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.checked=r.replaceSlot!==false;input.onchange=()=>r.replaceSlot=input.checked;label.append(input,document.createTextNode('Replace base clothing in this slot'));box.append(label);
   }
   const components=models.get(r.item)||[];
   if(components.length>1){const group=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Included components';group.append(summary);
    for(const source of components){const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.checked=!r.components||r.components.includes(source);input.onchange=()=>{const selected=new Set(r.components||components);if(input.checked)selected.add(source);else selected.delete(source);if(!selected.size){input.checked=true;return;}r.components=[...selected];};label.append(input,document.createTextNode(source.split('/').at(-1).replace('.gr2','').replaceAll('_',' ')));group.append(label);}box.append(group);
   }
   const dyes=document.createElement('details'),dyeTitle=document.createElement('summary');dyeTitle.textContent='Colors / individual components';dyes.append(dyeTitle);
   const sources=[['*','Whole layer'],...components.map(p=>[p,p.split('/').at(-1)])];
   for(const [source,title] of sources){
    const group=document.createElement('details'),summary=document.createElement('summary');summary.textContent=title;group.append(summary);
    for(const channel of ['primary','secondary']){
     const label=document.createElement('label');label.textContent=channel;group.append(label);
     const row=document.createElement('div');row.className='colorControl';const picker=document.createElement('input');picker.type='color';picker.value=r.colors?.[source]?.[channel]||'#808080';
     const hex=document.createElement('input');hex.type='text';hex.placeholder='Original';hex.value=r.colors?.[source]?.[channel]||'';
     colorView(r,()=>{hex.value=r.colors?.[source]?.[channel]||'';picker.value=hex.value||'#808080';hex.setCustomValidity('');});
     const change=v=>{if(v&&!/^#[0-9a-f]{6}$/i.test(v)){hex.setCustomValidity('Use #RRGGBB');hex.reportValidity();return;}hex.setCustomValidity('');r.colors??={};r.colors[source]??={};if(v)r.colors[source][channel]=v.toUpperCase();else{delete r.colors[source][channel];if(!Object.keys(r.colors[source]).length)delete r.colors[source];if(!Object.keys(r.colors).length)delete r.colors;}refreshColors(r);};
     picker.oninput=()=>change(picker.value);hex.onchange=()=>change(hex.value&&!hex.value.startsWith('#')?'#'+hex.value:hex.value);const reset=document.createElement('button');reset.textContent='Reset';reset.onclick=()=>change('');row.append(picker,hex,reset);group.append(row);
    }dyes.append(group);
   }box.append(dyes);
   const remove=document.createElement('button');remove.textContent='Remove layer';remove.onclick=()=>{layers.splice(i,1);render();};box.append(remove);$('equipmentLayers').append(box);
  });
  if(!layers.length)$('equipmentLayers').textContent='Choose an equipment slot or add an independent attachment.';
  pending();setControls();
 }
 async function search(){const seq=++sequence;$('equipmentCount').textContent='Reading local equipment catalog…';try{
  const r=await api.equipment({query:$('equipmentSearch').value,category:$('equipmentCategory').value,offset});if(seq!==sequence)return;total=r.total;
  if($('equipmentCategory').options.length===1){
   for(const c of r.categories)$('equipmentCategory').add(new Option(equipmentSlots.find(([key])=>key===c)?.[1]||c,c));
   if(r.categories.includes(targetSlot)&&$('equipmentCategory').value!==targetSlot){$('equipmentCategory').value=targetSlot;return search();}
  }
  $('equipmentCount').textContent=r.total.toLocaleString()+' appearances · duplicate names grouped';$('equipmentPrevious').disabled=!offset;$('equipmentNext').disabled=offset+40>=total;$('equipmentResults').replaceChildren();
  for(const item of r.items){names.set(item.id,item.name);kinds.set(item.id,item.kind);models.set(item.id,item.models||[item.model]);const button=document.createElement('button');button.className='clip';button.disabled=locked;button.textContent=item.name+' · '+item.category+' ('+item.aliasCount+' names)';button.title=item.model+'\n'+item.aliases.join('\n');button.onclick=()=>{
   if(locked)return;
   if(layers.length>=32&&replaceIndex===null){$('equipmentError').textContent='Use at most 32 layers.';return;}
   const preferred=item.kind==='armor'?'@skin':targetSlot==='off'?(bones.includes('LeftWeapon')?'LeftWeapon':null):item.category==='jetpack'?['vfx_jetpack_back','Spine2','Bip01_Spine2','socket_weapon_back_right'].find(b=>bones.includes(b)):bones.includes('RightWeapon')?'RightWeapon':bones[0];
   if(!preferred){$('equipmentError').textContent='This model has no attachment bones.';return;}
   const entry={item:item.id,bone:preferred,position:[0,0,0],rotation:[0,0,0],scale:1};
   if(replaceIndex!==null&&layers[replaceIndex]){layers[replaceIndex]=entry;selected=replaceIndex;}else{layers.push(entry);selected=layers.length-1;}render();closePicker();};$('equipmentResults').append(button);
  }
 }catch(e){if(seq===sequence)$('equipmentCount').textContent=e.message;}}
 $('equipmentOpen').onclick=()=>picker();
 $('equipmentClose').onclick=closePicker;$('equipmentSearch').oninput=()=>{clearTimeout(timer);offset=0;timer=setTimeout(search,200);};$('equipmentCategory').onchange=()=>{clearTimeout(timer);offset=0;search();};$('equipmentPrevious').onclick=()=>{offset=Math.max(0,offset-40);search();};$('equipmentNext').onclick=()=>{offset+=40;search();};
 $('equipmentApply').onclick=async()=>{
  if(locked||applying)return false;
  const invalid=$('equipmentDialog').querySelector('input:invalid');
  if(invalid){
   const index=[...$('equipmentLayers').children].findIndex(n=>n.contains(invalid));
   if(index>=0){selected=index;for(const [i,n] of [...$('equipmentLayers').children].entries())n.hidden=i!==selected;}
   for(const parent of $('equipmentDialog').querySelectorAll('details'))if(parent.contains(invalid))parent.open=true;
   invalid.reportValidity();return false;
  }
  applying=true;pending();$('equipmentError').textContent='Applying equipment…';
  try{
   const ok=await apply(structuredClone(layers));
   if(ok){baseline=JSON.stringify(getContext().equipment||[]);resetLayers(getContext().equipment||[]);$('equipmentError').textContent='Equipment applied';closePicker();render();}
   else $('equipmentError').textContent=$('status').textContent;
   return ok;
  }catch(e){$('equipmentError').textContent=e.message;return false;}
  finally{applying=false;pending();}
 };
 $('equipmentRevert').onclick=()=>{resetLayers(JSON.parse(baseline));$('equipmentError').textContent='Unapplied equipment changes reverted';render();};
 $('equipmentDialog').addEventListener('input',pending);$('equipmentDialog').addEventListener('change',pending);
 function setControls(){for(const input of $('equipmentDialog').querySelectorAll('button,input,select')){if(locked){if(input.dataset.equipmentDisabled===undefined)input.dataset.equipmentDisabled=String(input.disabled);input.disabled=true;}else if(input.dataset.equipmentDisabled!==undefined){input.disabled=input.dataset.equipmentDisabled==='true';delete input.dataset.equipmentDisabled;}}pending();}
 function refresh(){const ctx=getContext(),incoming=JSON.stringify(ctx.equipment||[]);bones=ctx.bones||[];parts=ctx.parts||[];for(const [id,values] of Object.entries(ctx.components||{}))models.set(id,values);for(const [id,name] of Object.entries(ctx.labels||{}))names.set(id,name);
  if(ctx.identity!==contextKey||incoming!==baseline){const base=JSON.parse(baseline),next=ctx.equipment||[];
   if(ctx.identity===contextKey&&dirty()&&base.length===next.length&&base.every((r,i)=>r.item===next[i].item)){
    const indices=layers.map(r=>origins.get(r));layers=reconcileEquipmentDraft(base,layers,next,indices);origins=new WeakMap(layers.flatMap((r,i)=>indices[i]===undefined?[]:[[r,indices[i]]]));
   }else resetLayers(next);baseline=incoming;contextKey=ctx.identity;closePicker();}
  $('equipmentError').textContent=bones.length?(ctx.warnings||[]).join(' · '):'Choose a model with a skeleton first.';render();
 }
 refresh.setBusy=value=>{if(locked===value)return;locked=value;setControls();for(const button of $('equipmentPicker').querySelectorAll('button,input,select')){if(value){button.dataset.equipmentDisabled=String(button.disabled);button.disabled=true;}else{button.disabled=button.dataset.equipmentDisabled==='true';delete button.dataset.equipmentDisabled;}}};
 return refresh;
}

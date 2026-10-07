import {saberEditor} from './saber-editor.js';
export function equipmentUI(api,getContext,apply){
 const $=id=>document.getElementById(id);let layers=[],names=new Map(),kinds=new Map(),models=new Map(),offset=0,total=0,sequence=0,bones=[],parts=[];
 const labels={vfx_jetpack_back:'Jetpack / back',RightWeapon:'Right hand / two-handed grip',LeftWeapon:'Left hand',socket_saber_right:'Right hip / holster',socket_saber_left:'Left hip / holster',socket_weapon_back_right:'Back right',socket_weapon_back_left:'Back left',socket_weapon_back_left_upper:'Back upper left',Spine2:'Upper back / jetpack (Spine2)',Bip01_Spine2:'Upper back / jetpack'};
 function render(){
  $('equipmentLayers').replaceChildren();
  layers.forEach((r,i)=>{
   const box=document.createElement('div');box.className='equipmentLayer';const name=document.createElement('strong');name.textContent=names.get(r.item)||r.item;box.append(name);
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
     const change=v=>{if(v&&!/^#[0-9a-f]{6}$/i.test(v)){hex.setCustomValidity('Use #RRGGBB');hex.reportValidity();return;}hex.setCustomValidity('');r.colors??={};r.colors[source]??={};if(v)r.colors[source][channel]=v;else delete r.colors[source][channel];hex.value=v;picker.value=v||'#808080';};
     picker.oninput=()=>change(picker.value);hex.onchange=()=>change(hex.value&&!hex.value.startsWith('#')?'#'+hex.value:hex.value);const reset=document.createElement('button');reset.textContent='Reset';reset.onclick=()=>change('');row.append(picker,hex,reset);group.append(row);
    }dyes.append(group);
   }box.append(dyes);
   const remove=document.createElement('button');remove.textContent='Remove layer';remove.onclick=()=>{layers.splice(i,1);render();};box.append(remove);$('equipmentLayers').append(box);
  });
  if(!layers.length)$('equipmentLayers').textContent='No additional equipment. Add an item from the catalog.';
 }
 async function search(){const seq=++sequence;$('equipmentCount').textContent='Reading local equipment catalog…';try{
  const r=await api.equipment({query:$('equipmentSearch').value,category:$('equipmentCategory').value,offset});if(seq!==sequence)return;total=r.total;
  if($('equipmentCategory').options.length===1)for(const c of r.categories)$('equipmentCategory').add(new Option(c,c));
  $('equipmentCount').textContent=r.total.toLocaleString()+' appearances · duplicate names grouped';$('equipmentPrevious').disabled=!offset;$('equipmentNext').disabled=offset+40>=total;$('equipmentResults').replaceChildren();
  for(const item of r.items){names.set(item.id,item.name);kinds.set(item.id,item.kind);models.set(item.id,item.models||[item.model]);const button=document.createElement('button');button.className='clip';button.textContent=item.name+' · '+item.category+' ('+item.aliasCount+' names)';button.title=item.model+'\n'+item.aliases.join('\n');button.onclick=()=>{
   if(layers.length>=32){$('equipmentError').textContent='Use at most 32 layers.';return;}
   const preferred=item.kind==='armor'?'@skin':item.category==='jetpack'?['vfx_jetpack_back','Spine2','Bip01_Spine2','socket_weapon_back_right'].find(b=>bones.includes(b)):bones.includes('RightWeapon')?'RightWeapon':bones[0];
   if(!preferred){$('equipmentError').textContent='This model has no attachment bones.';return;}
   layers.push({item:item.id,bone:preferred,position:[0,0,0],rotation:[0,0,0],scale:1});render();};$('equipmentResults').append(button);
  }
 }catch(e){$('equipmentCount').textContent=e.message;}}
 $('equipmentOpen').onclick=()=>{const ctx=getContext();bones=ctx.bones||[];parts=ctx.parts||[];for(const [id,values] of Object.entries(ctx.components||{}))models.set(id,values);for(const [id,name] of Object.entries(ctx.labels||{}))names.set(id,name);layers=structuredClone(ctx.equipment||[]);$('equipmentError').textContent=bones.length?(ctx.warnings||[]).join(' · '):'Choose a model with a skeleton first.';render();$('equipmentDialog').showModal();search();};
 $('equipmentClose').onclick=()=>$('equipmentDialog').close();let timer;$('equipmentSearch').oninput=()=>{clearTimeout(timer);offset=0;timer=setTimeout(search,200);};$('equipmentCategory').onchange=()=>{offset=0;search();};$('equipmentPrevious').onclick=()=>{offset=Math.max(0,offset-40);search();};$('equipmentNext').onclick=()=>{offset+=40;search();};
 $('equipmentApply').onclick=async()=>{const invalid=$('equipmentDialog').querySelector('input:invalid');if(invalid){invalid.reportValidity();return;}const button=$('equipmentApply');button.disabled=true;$('equipmentError').textContent='Applying equipment…';try{if(await apply(structuredClone(layers)))$('equipmentDialog').close();else $('equipmentError').textContent=$('status').textContent;}catch(e){$('equipmentError').textContent=e.message;}finally{button.disabled=false;}};
 return ()=>{$('equipmentSummary').textContent=(getContext().equipment?.length||0)+' additional equipment layers';};
}

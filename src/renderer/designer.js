// Native appearance choices are resolved by the same local data used for NPCs.
export function nativeDesigner(api,{getState,apply,status}){
 const $=id=>document.getElementById(id);let draft,options,sequence=0,lastParts=[];
 const bodies={male:['bma','bmn','bms','bmf'],female:['bfa','bfn','bfs','bfb']};
 function swatch(parent,label,value,change){
  const title=document.createElement('label');title.textContent=label;parent.append(title);
  const row=document.createElement('div');row.className='colorControl';
  const picker=document.createElement('input');picker.type='color';picker.value=value||'#808080';picker.setAttribute('aria-label',label);
  const hex=document.createElement('input');hex.type='text';hex.value=value||'';hex.placeholder='Original';hex.maxLength=7;hex.setAttribute('aria-label',label+' hex');
  const set=v=>{if(v&&!/^#[0-9a-f]{6}$/i.test(v)){hex.setCustomValidity('Use #RRGGBB');hex.reportValidity();return;}hex.setCustomValidity('');hex.value=v||'';picker.value=v||'#808080';change(v||null);};
  picker.oninput=()=>set(picker.value);hex.onchange=()=>set(hex.value&&!hex.value.startsWith('#')?'#'+hex.value:hex.value);
  const reset=document.createElement('button');reset.textContent='Reset';reset.onclick=()=>set(null);row.append(picker,hex,reset);parent.append(row);
 }
 async function refresh(){
  const seq=++sequence;$('nativeApply').disabled=true;
  try{const result=await api.designerOptions(draft);if(seq!==sequence)return;options=result;draft=result.designer;render();}
  catch(e){status(e.message);}finally{if(seq===sequence)$('nativeApply').disabled=false;}
 }
 function render(){
  $('nativeSpecies').replaceChildren(...options.species.map(s=>new Option(s.name,s.id)));$('nativeSpecies').value=draft.species;
  $('nativeGender').value=options.profile.gender;$('nativeBody').value=options.profile.bodyType;
  $('nativeChoices').replaceChildren();
  const labels=options.profile.labels;
  for(const [slot,choices] of Object.entries(options.groups)){
   if(!choices.length)continue;
   const label=document.createElement('label');label.textContent=labels[slot]||slot.replace('appSlot','');
   const select=document.createElement('select');select.dataset.slot=slot;select.setAttribute('aria-label',label.textContent);
   if(slot!=='appSlotHead')select.add(new Option('None / no override',''));
   choices.forEach((choice,index)=>{const option=new Option(`${index+1} · ${choice.label||choice.name}`,choice.id);option.title=[choice.name,...choice.attachments].join('\n');select.add(option);});
   const description=document.createElement('div');description.className='choiceDescription';
   const explain=()=>{const choice=choices.find(c=>c.id===select.value);description.replaceChildren();if(!choice)return;if(choice.swatch){const swatch=document.createElement('input');swatch.type='color';swatch.value=choice.swatch;swatch.disabled=true;swatch.title='Approximate native palette color';description.append(swatch);}const text=document.createElement('span');text.textContent=(choice.swatch?'Approximate palette · ':'')+(choice.label||choice.name);text.title=choice.name;description.append(text);};

   select.value=draft.choices[slot]||'';
   select.onchange=()=>{draft.choices[slot]=select.value||null;explain();if(slot==='appSlotHead')refresh();};
   explain();$('nativeChoices').append(label,select,description);
  }
  $('nativeSource').textContent=draft.sourceNpc?`Editing a copy of ${options.sourceName||'an NPC'}. Changes do not alter the source NPC.`:'Options from your installed game. Class and unlock restrictions are not enforced.';
 }
 function changeProfile(){draft.species=$('nativeSpecies').value;draft.body=bodies[$('nativeGender').value][Number($('nativeBody').value)-1];draft.choices={};draft.useNpcAppearance=false;return refresh();}
 for(const key of ['nativeSpecies','nativeGender','nativeBody'])$(key).onchange=changeProfile;
 $('nativeApply').onclick=async()=>{
  const invalid=$('nativeDesigner').querySelector('input:invalid');if(invalid){invalid.reportValidity();return false;}
  const current=getState();const changed=current.designer?.body!==draft.body;
  return apply({...current,version:2,character:'native-designer',designer:structuredClone(draft),appearance:{body:draft.body},hidden:changed?[]:current.hidden,time:changed?0:current.time});
 };
 $('nativeNew').onclick=()=>apply({...getState(),version:2,character:'native-designer',designer:{species:draft.species,body:draft.body,choices:{},colors:{}},appearance:{body:draft.body},clip:null,expression:null,time:0,hidden:[],equipment:[],weapon:'none',rootMotion:false});
 $('nativeReset').onclick=()=>sync(getState());
 function colors(parts){
  $('nativeColors').replaceChildren();
  const add=(parent,key,title)=>{for(const [channel,label] of [['primary','Primary'],['secondary','Secondary']])swatch(parent,title+' · '+label,draft.colors[key]?.[channel],value=>{draft.colors[key]??={};if(value)draft.colors[key][channel]=value;else delete draft.colors[key][channel];});};
  const global=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Skin, eyes and hair';global.append(summary);
  for(const [key,label] of [['skin','Skin'],['eyes','Eyes'],['hair','Hair / facial hair']])swatch(global,label,draft.colors[key]?.primary,value=>{draft.colors[key]??={};if(value)draft.colors[key].primary=value;else delete draft.colors[key].primary;});
  $('nativeColors').append(global);
  const seen=new Set();for(const part of parts||[]){if(part.equipmentLayer!==undefined||!part.source||seen.has(part.source))continue;seen.add(part.source);
   const details=document.createElement('details'),summary=document.createElement('summary');const name=part.source.split('/').at(-1).replace('.gr2','');const component=name.match(/_(?:a\d+|archetype)_(.+)$/)?.[1];summary.textContent=part.slot+(component?' · '+component.replaceAll('_',' '):'');summary.title=part.source;details.append(summary);add(details,part.source,'Dye');$('nativeColors').append(details);
  }
 }
 async function sync(state,parts=lastParts){lastParts=parts;draft=structuredClone(state.designer||{species:'human',body:state.appearance?.body||'bmn',choices:{},colors:{}});draft.colors??={};await refresh();colors(parts);}
 return {sync,get draft(){return draft;}};
}

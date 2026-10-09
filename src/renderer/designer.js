// Native appearance choices are resolved by the same local data used for NPCs.
import {colorMenu} from './color-menu.js';
import {paletteChannel,appliedPalette} from './palette-channel.js';
export function nativeDesigner(api,{getState,apply,status}){
 const $=id=>document.getElementById(id);let draft,options,sequence=0,lastParts=[],baseline='';
 const bodies={male:['bma','bmn','bms','bmf'],female:['bfa','bfn','bfs','bfb']};
 const colorKeys={appSlotSkinColor:['skin','Skin color'],appSlotEyeColor:['eyes','Eye color'],appSlotHairColor:['hair','Hair color']};
 function pending(){const changed=JSON.stringify(draft)!==baseline;$('nativeApply').textContent=changed?'Apply appearance · changes pending':'Apply appearance';$('nativeReset').disabled=!changed;}
 function globalMenu(key,title){return colorMenu('Custom '+title.toLowerCase(),[paletteChannel(()=>draft.colors,key,'primary','Color',undefined,null,()=>appliedPalette(lastParts,'primary',{skin:'SkinB',eyes:'Eye',hair:'HairC'}[key]))],pending);}
 async function refresh(){
  const seq=++sequence,requested=structuredClone(draft);$('nativeApply').disabled=true;
  try{
   const result=await api.designerOptions(requested);if(seq!==sequence)return;
   // Color and ordinary appearance edits can arrive while dependent options load.
   result.designer.colors=structuredClone(draft.colors);
   for(const [slot,value] of Object.entries(draft.choices))if(value!==requested.choices[slot]&&(!value||result.groups[slot]?.some(choice=>choice.id===value)))result.designer.choices[slot]=value;
   options=result;draft=result.designer;render();colors(lastParts);pending();$('nativeApply').disabled=false;
  }catch(e){if(seq===sequence)status(e.message);}
 }
 function render(){
  $('nativeSpecies').replaceChildren(...options.species.map(s=>new Option(s.name,s.id)));$('nativeSpecies').value=draft.species;
  $('nativeGender').value=options.profile.gender;$('nativeBody').value=options.profile.bodyType;
  $('nativeChoices').replaceChildren();
  const labels=options.profile.labels;
  for(const [slot,choices] of Object.entries(options.groups)){
   if(!choices.length)continue;
   const row=document.createElement('div');row.className='appearanceChoice';
   const label=document.createElement('label');label.textContent=labels[slot]||slot.replace('appSlot','');label.htmlFor='choice-'+slot;
   const select=document.createElement('select');select.dataset.slot=slot;select.setAttribute('aria-label',label.textContent);
   select.id='choice-'+slot;
   if(slot!=='appSlotHead')select.add(new Option('None / no override',''));
   choices.forEach((choice,index)=>{const option=new Option(`${index+1} · ${choice.label||choice.name}`,choice.id);option.title=[choice.name,...choice.attachments].join('\n');select.add(option);});
   const description=document.createElement('div');description.className='choiceDescription';
   const explain=()=>{const choice=choices.find(c=>c.id===select.value);description.replaceChildren();if(!choice)return;if(choice.swatch){const swatch=document.createElement('input');swatch.type='color';swatch.value=choice.swatch;swatch.disabled=true;swatch.title='Approximate native palette color';description.append(swatch);}const text=document.createElement('span');text.textContent=(choice.swatch?'Approximate palette · ':'')+(choice.label||choice.name);text.title=choice.name;description.append(text);};

   select.value=draft.choices[slot]||'';
   select.onchange=()=>{draft.choices[slot]=select.value||null;explain();pending();if(slot==='appSlotHead')return refresh();};
   const controls=document.createElement('div');controls.className='appearanceControl';controls.append(select);
   if(colorKeys[slot])controls.append(globalMenu(...colorKeys[slot]));
   explain();row.append(label,controls,description);$('nativeChoices').append(row);
  }
  $('nativeSource').textContent=draft.sourceNpc?`Editing a copy of ${options.sourceName||'an NPC'}. Changes do not alter the source NPC.`:'Options from your installed game. Class and unlock restrictions are not enforced.';
 }
 function changeProfile(){draft.species=$('nativeSpecies').value;draft.body=bodies[$('nativeGender').value][Number($('nativeBody').value)-1];draft.choices={};draft.useNpcAppearance=false;return refresh();}
 for(const key of ['nativeSpecies','nativeGender','nativeBody'])$(key).onchange=changeProfile;
 $('nativeApply').onclick=async()=>{
  const invalid=$('nativeDesigner').querySelector('input:invalid');if(invalid){for(const parent of $('nativeDesigner').querySelectorAll('details'))if(parent.contains(invalid))parent.open=true;invalid.reportValidity();return false;}
  const current=getState();const changed=current.designer?.body!==draft.body;
  return apply({...current,version:2,character:'native-designer',designer:structuredClone(draft),appearance:{body:draft.body},hidden:changed?[]:current.hidden,time:changed?0:current.time});
 };
 $('nativeNew').onclick=()=>apply({...getState(),version:2,character:'native-designer',designer:{species:draft.species,body:draft.body,choices:{},colors:{}},appearance:{body:draft.body},clip:null,expression:null,time:0,hidden:[],equipment:[],weapon:'none',rootMotion:false});
 $('nativeReset').onclick=()=>sync(getState(),lastParts,true);
 function colors(parts){
  const currentColors=draft.colors;
  $('nativeColors').replaceChildren();
  // Some species do not expose a native palette row. Keep supported custom overrides reachable.
  for(const [slot,[key,title]] of Object.entries(colorKeys))if(!options.groups[slot]?.length){const row=document.createElement('div');row.className='pieceColorRow';const label=document.createElement('span');label.textContent=title;row.append(label,globalMenu(key,title));$('nativeColors').append(row);}
  const seen=new Set();for(const part of parts||[]){if(part.equipmentLayer!==undefined||!part.source||seen.has(part.source))continue;seen.add(part.source);
   const row=document.createElement('div');row.className='pieceColorRow';const label=document.createElement('span');const name=part.source.split('/').at(-1).replace('.gr2','');const component=name.match(/_(?:a\d+|archetype)_(.+)$/)?.[1];label.textContent=part.slot+(component?' · '+component.replaceAll('_',' '):'');label.title=part.source;
   row.append(label,colorMenu(label.textContent+' colors',[['primary','Primary'],['secondary','Secondary']].map(([channel,title])=>paletteChannel(()=>currentColors,part.source,channel,title,undefined,null,()=>appliedPalette(part,channel))),pending));$('nativeColors').append(row);
  }
 }
 $('nativeDesigner').addEventListener('input',pending);$('nativeDesigner').addEventListener('change',pending);
 async function sync(state,parts=lastParts,force=false){lastParts=parts;const incoming=JSON.stringify(state.designer||{species:'human',body:state.appearance?.body||'bmn',choices:{},colors:{}});if(force||incoming!==baseline||!draft){draft=JSON.parse(incoming);draft.colors??={};baseline=incoming;}await refresh();}
 return {sync,get draft(){return draft;}};
}

// Native disclosure, with a full row-width color editor so narrow panels do not clip it.
export function colorMenu(title,channels,onChange,groups=[]){
 const menu=document.createElement('details');menu.className='customColorMenu';
 const summary=document.createElement('summary');summary.setAttribute('aria-label',title);summary.title=title;
 const dot=document.createElement('span');dot.className='colorPreview';dot.setAttribute('aria-hidden','true');summary.append(dot,document.createTextNode(' ▾'));
 const content=document.createElement('div');content.className='colorMenuContent';
 const heading=document.createElement('strong');heading.textContent=title;content.append(heading);
 const controls=[];
 let selectedGroup=0;
 const updateDot=()=>{const value=controls[0]?.channel.value;dot.style.background=value||'';dot.classList.toggle('original',!value);summary.title=title+(groups[selectedGroup]?.label?' · '+groups[selectedGroup].label:'')+(value?' · '+value:' · Original');};
 let pieces;
 if(groups.length>1){const label=document.createElement('label');label.textContent='Piece';pieces=document.createElement('select');pieces.setAttribute('aria-label',title+' piece');groups.forEach((g,i)=>pieces.add(new Option(g.label,String(i))));content.append(label,pieces);}
 for(const channel of channels){
  const label=document.createElement('label');label.textContent=channel.label;content.append(label);
  const row=document.createElement('div');row.className='colorControl';
  const picker=document.createElement('input');picker.type='color';picker.value=channel.value||'#808080';picker.setAttribute('aria-label',title+' · '+channel.label);
  const hex=document.createElement('input');hex.type='text';hex.value=channel.value||'';hex.placeholder='Original';hex.maxLength=7;hex.setAttribute('aria-label',title+' · '+channel.label+' hex');
  const control={channel,picker,hex};controls.push(control);
  const set=value=>{if(value&&!/^#[0-9a-f]{6}$/i.test(value)){hex.setCustomValidity('Use #RRGGBB');hex.reportValidity();return;}value=value?.toUpperCase()||null;hex.setCustomValidity('');control.channel.value=value||null;hex.value=value||'';picker.value=value||'#808080';control.channel.change(value||null);updateDot();onChange?.();};
  picker.oninput=()=>set(picker.value);hex.onchange=()=>set(hex.value&&!hex.value.startsWith('#')?'#'+hex.value:hex.value);
  const reset=document.createElement('button');reset.type='button';reset.textContent='Reset';reset.onclick=()=>set(null);row.append(picker,hex,reset);content.append(row);
 }
 menu.append(summary,content);updateDot();
 menu.refresh=values=>{controls.forEach(({channel,picker,hex},i)=>{channel.value=channel.read?channel.read():values?values[i]||null:channel.value;picker.value=channel.value||'#808080';hex.value=channel.value||'';hex.setCustomValidity('');});updateDot();};
 if(pieces)pieces.onchange=()=>{selectedGroup=Number(pieces.value);const group=groups[selectedGroup];controls.forEach((control,i)=>{control.channel=group.channels[i];const prefix=title+(selectedGroup?' · '+group.label:'');control.picker.setAttribute('aria-label',prefix+' · '+control.channel.label);control.hex.setAttribute('aria-label',prefix+' · '+control.channel.label+' hex');});menu.refresh();};
 menu.addEventListener('toggle',()=>{if(menu.open&&menu.isConnected)for(const other of document.querySelectorAll('.customColorMenu[open]'))if(other!==menu)other.open=false;});
 menu.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.open=false;summary.focus();event.stopPropagation();}});
 menu.addEventListener('focusout',event=>{if(event.relatedTarget&&!menu.contains(event.relatedTarget))menu.open=false;});
 return menu;
}

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
  if(channel.readPalette){
   const fine=document.createElement('details');fine.className='paletteFine';
   const disclosure=document.createElement('summary');disclosure.textContent='Fine-tune color';fine.append(disclosure);
   const help=document.createElement('p');help.className='muted';help.textContent='Blank uses the wheel or original material. Arrows step by 0.1 from the applied preview value. Apply wheel changes before fine-tuning. Saturation: 0 = strongest, 1 = gray. A new wheel color resets these values.';fine.append(help);
   const fields=[];
   for(const [name,min,max] of [['hue',0,1],['saturation',0,1],['brightness',-1,1],['contrast',0,3]]){
    const label=document.createElement('label');label.textContent=name[0].toUpperCase()+name.slice(1);
    const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step='any';input.placeholder='Automatic';input.setAttribute('aria-label',channel.label+' native '+name);
    input.onchange=()=>{if(!input.checkValidity()){input.reportValidity();return;}const values={...control.channel.readPalette()};if(input.value==='')delete values[name];else values[name]=Number(input.value);control.channel.changePalette(values);onChange?.();};
    const adjust=direction=>{if(!input.checkValidity()){input.reportValidity();return;}const defaults={hue:0,saturation:.5,brightness:0,contrast:1};const base=input.value!==''?Number(input.value):(control.channel.readBasePalette?.()[name]??defaults[name]);input.value=String(Math.max(min,Math.min(max,Math.round((base+direction*.1)*1e10)/1e10)));input.onchange();};
    const adjustor=document.createElement('span');adjustor.className='paletteAdjustor';
    const arrows=document.createElement('span');arrows.className='paletteArrows';
    for(const [symbol,direction,action] of [['▴',1,'Increase'],['▾',-1,'Decrease']]){
     const button=document.createElement('button');button.type='button';button.textContent=symbol;button.title=action+' by 0.1';button.setAttribute('aria-label',action+' '+channel.label+' '+name+' by 0.1');button.onclick=()=>adjust(direction);arrows.append(button);
    }
    input.addEventListener('keydown',event=>{if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();adjust(event.key==='ArrowUp'?1:-1);}});
    adjustor.append(input,arrows);label.append(adjustor);fine.append(label);fields.push([name,input]);
   }
   const clear=document.createElement('button');clear.type='button';clear.textContent='Reset fine-tuning';clear.onclick=()=>{control.channel.changePalette({});control.refreshPalette();onChange?.();};fine.append(clear);content.append(fine);
   control.refreshPalette=()=>{const values=control.channel.readPalette();const base=control.channel.readBasePalette?.()||{};for(const [name,input] of fields){input.value=values[name]??'';input.placeholder=base[name]===undefined?'Automatic':String(Number(base[name].toFixed(4)))+' · auto';input.setAttribute('aria-label',title+' · '+control.channel.label+' native '+name);}};control.refreshPalette();
   picker.addEventListener('input',()=>control.refreshPalette());hex.addEventListener('change',()=>control.refreshPalette());reset.addEventListener('click',()=>control.refreshPalette());
  }
 }
 menu.append(summary,content);updateDot();
 menu.refresh=values=>{controls.forEach((control,i)=>{const {channel,picker,hex}=control;channel.value=channel.read?channel.read():values?values[i]||null:channel.value;picker.value=channel.value||'#808080';hex.value=channel.value||'';hex.setCustomValidity('');control.refreshPalette?.();});updateDot();};
 if(pieces)pieces.onchange=()=>{selectedGroup=Number(pieces.value);const group=groups[selectedGroup];controls.forEach((control,i)=>{control.channel=group.channels[i];const prefix=title+(selectedGroup?' · '+group.label:'');control.picker.setAttribute('aria-label',prefix+' · '+control.channel.label);control.hex.setAttribute('aria-label',prefix+' · '+control.channel.label+' hex');});menu.refresh();};
 menu.addEventListener('toggle',()=>{if(menu.open&&menu.isConnected)for(const other of document.querySelectorAll('.customColorMenu[open]'))if(other!==menu)other.open=false;});
 menu.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.open=false;summary.focus();event.stopPropagation();}});
 menu.addEventListener('focusout',event=>{if(event.relatedTarget&&!menu.contains(event.relatedTarget))menu.open=false;});
 return menu;
}

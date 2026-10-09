// Both compact color menus and piece controls edit the same saved values.
export function appliedPalette(parts,channel,family=null){
 const index=channel==='secondary'?'2':'1';
 for(const part of Array.isArray(parts)?parts:[parts])for(const info of part?.nativePalettes||[]){
  const vector=info.palettes?.[index];
  if((!family||info.family===family)&&Array.isArray(vector)&&vector.length===4)
   return Object.fromEntries(['hue','saturation','brightness','contrast'].map((name,i)=>[name,vector[i]]));
 }
 return {};
}

export function paletteChannel(getColors,key,channel,label,onUpdate,fallback=null,readBasePalette=()=>({})){
 const effective=()=>getColors()[key]??(fallback?getColors()[fallback]:null)??{};
 const write=(field,value)=>{
  const colors=getColors();colors[key]??=structuredClone(effective());
  if(value!=null)colors[key][field]=value;else delete colors[key][field];
  if(!Object.keys(colors[key]).length&&!fallback)delete colors[key];
  onUpdate?.();
 };
 return {label,value:effective()[channel],read:()=>effective()[channel]||null,
  change:value=>{write(channel,value);write(channel+'Palette',null);},
  readPalette:()=>effective()[channel+'Palette']||{},
  readBasePalette,
  changePalette:controls=>write(channel+'Palette',Object.keys(controls).length?controls:null)};
}

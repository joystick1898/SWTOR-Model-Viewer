export const equipmentSlots=[['face','Head'],['chest','Chest'],['hand','Hands'],['waist','Waist'],['bracer','Wrists'],['leg','Legs'],['boot','Feet'],['main','Main hand'],['off','Off hand']];
export function equipmentSlot(layer,models=[],parts=[]){
 if(layer.bone==='@skin'){
  const slot=parts.find(p=>equipmentSlots.some(([key])=>key===p.slot))?.slot;
  return slot||models.map(p=>p.match(/\/dynamic\/(face|chest|hand|waist|bracer|leg|boot)\//i)?.[1]?.toLowerCase()).find(Boolean)||null;
 }
 if(layer.bone==='RightWeapon')return 'main';
 if(layer.bone==='LeftWeapon')return 'off';
 return null;
}
// A live gizmo may update the applied state while colors/components remain unapplied.
// Merge only when the applied layer identities still match; a new preset starts a new draft.
export function reconcileEquipmentDraft(base,draft,incoming,origins=draft.map((_,i)=>i)){
 if(base.length!==incoming.length||base.some((r,i)=>r.item!==incoming[i].item))return structuredClone(incoming);
 return draft.map((r,index)=>{
  const i=origins[index];
  if(!base[i]||base[i].item!==r.item)return structuredClone(r);
  const next=structuredClone(incoming[i]);
  for(const key of new Set([...Object.keys(base[i]),...Object.keys(r)]))if(JSON.stringify(r[key])!==JSON.stringify(base[i][key])){if(r[key]===undefined)delete next[key];else next[key]=structuredClone(r[key]);}
  return next;
 });
}

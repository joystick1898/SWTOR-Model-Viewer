// Shared by the equipment editor and preset validator; no Node dependencies.
export const saberEffects=[['native','Native hilt effect'],['standard','Standard'],['unstable','Unstable'],['relic','Relic'],['vented','Vented'],['vintage','Vintage'],['mamba','Mamba'],['tau','Tau'],['nul','Nul']];
export const saberGroups=[['single','Single Blade'],['dual','Dual Blade (bottom)'],['straight','Straight Crossguard'],['diagonal','Diagonal Crossguard']];
export const saberElements=[['single','Main blade','single'],['dual','Bottom blade','dual'],['straightLeft','Straight guard · left','straight'],['straightRight','Straight guard · right','straight'],['diagonalLeft','Diagonal guard · left','diagonal'],['diagonalRight','Diagonal guard · right','diagonal']];
export function elementDefaults(blade,key){
 const guard=key!=='single'&&key!=='dual';
 return {position:[0,key.startsWith('straight')?2:key.startsWith('diagonal')?-.3:0,0],rotation:[0,0,0],core:blade.core??'#ffffff',glow:blade.glow??'#4080ff',length:(blade.length??90)*(guard ? .15 : 1),width:guard?1:(blade.width??2),intensity:blade.intensity??1.5};
}
export function editableBlade(blade,dual=false){
 const b=structuredClone(blade??{enabled:false});
 if(b.effect==='pulsing')b.effect='standard';
 b.motion??='static';b.frame??=0;
 // Preserve the two main blades from older presets when entering the editor.
 // Guard groups are an explicit user choice; all four groups are unrestricted.
 b.layout??={single:b.enabled,dual:b.enabled&&dual,straight:false,diagonal:false};
 b.elements??={};
 for(const [key] of saberElements)b.elements[key]??=elementDefaults(b,key);
 b.enabled=Object.values(b.layout).some(Boolean);
 return b;
}

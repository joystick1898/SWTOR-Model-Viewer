// Catalog attachments can outlive the files shipped in the game archives.
// Resolve them before Blender, preserving warnings for the equipment panel.
export const equipmentBodies=['bma','bmn','bms','bmf','bfa','bfn','bfs','bfb'];
export function equipmentModelPath(template,body){return template.replaceAll('[bt]',body).replaceAll('[gen]',body.startsWith('bf')?'f':'m');}
// Some art indexes file a face mesh under head/model. Correct only this known
// directory mismatch, retaining the exact filename and body variant.
export function equipmentModelAlternative(model){
 return /^art\/dynamic\/head\/model\/face_[^/]+\.gr2$/.test(model)?model.replace('/head/model/','/face/model/'):null;
}
export async function inspectEquipmentModels(entry,exists){
 const models=[],missing=[],remapped={};
 for(const model of entry.models){
  if(await exists(model)){models.push(model);continue;}
  const alternative=equipmentModelAlternative(model);
  if(alternative&&await exists(alternative)){models.push(alternative);remapped[model]=alternative;}
  else missing.push(model);
 }
 const base=equipmentModelPath(entry.modelTemplates[0],entry.body);
 const unavailable=!models.length||missing.some(p=>entry.kind!=='armor'||p===base);
 const status=unavailable?'unavailable':missing.length?'partial':'available';
 const message=unavailable?`${entry.name} is unavailable for body ${entry.body}: required model files are absent from the extraction and installed archives.`:missing.length?`${entry.name}: ${missing.length} missing attachment${missing.length===1?'':'s'}; the appearance may be incomplete.`:'';
 return {status,message,models,missing,remapped};
}
export async function availableEquipmentModels(entry, exists) {
 const check=await inspectEquipmentModels(entry,exists);
 if(check.status==='unavailable')throw Error(check.message+' Missing: '+check.missing.join(', '));
 const warnings=[...(entry.warnings||[])];
 for(const [original,replacement] of Object.entries(check.remapped))warnings.push(`Corrected equipment model directory: ${original} → ${replacement}`);
 if(check.missing.length)warnings.push(check.message);
 for(const model of check.missing)warnings.push(`Attachment file absent from both extraction and installed archives: ${model}`);
 const result={...entry,models:check.models,warnings};
 if(Object.keys(check.remapped).length)result.modelSources=Object.fromEntries(Object.entries(check.remapped).map(([original,resolved])=>[resolved,original]));
 if(entry.colors)result.colors=Object.fromEntries(Object.entries(entry.colors).map(([p,v])=>[check.remapped[p]||p,v]));
 return result;
}

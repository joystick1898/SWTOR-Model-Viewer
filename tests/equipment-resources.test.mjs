import test from 'node:test';
import assert from 'node:assert/strict';
import {availableEquipmentModels,inspectEquipmentModels,equipmentModelAlternative} from '../src/equipment-resources.mjs';
const base='art/dynamic/face/model/face_trhelmet46_[bt]_archetype.gr2';
const attachment='art/dynamic/face/model/face_trhelmet46_bmn_attachment.gr2';
const helmet={name:'Reforged Havoc Squad Helmet',kind:'armor',body:'bmn',modelTemplates:[base],models:[base.replace('[bt]','bmn'),attachment],warnings:['Existing warning']};
test('obsolete helmet attachment does not prevent importing the available helmet',async()=>{
 const result=await availableEquipmentModels(helmet,p=>p!==attachment);
 assert.deepEqual(result.models,[helmet.models[0]]);
 assert.deepEqual(result.warnings,['Existing warning','Reforged Havoc Squad Helmet: 1 missing attachment; the appearance may be incomplete.',`Attachment file absent from both extraction and installed archives: ${attachment}`]);
 assert.equal(helmet.models.length,2);
});
test('recovered attachments remain part of the armor',async()=>{
 assert.deepEqual(await availableEquipmentModels(helmet,()=>true),helmet);
});
test('missing base, rigid equipment, and entirely missing selections fail clearly',async()=>{
 await assert.rejects(availableEquipmentModels(helmet,()=>false),/unavailable for body bmn/);
 await assert.rejects(availableEquipmentModels({...helmet,kind:'rigid'},p=>p!==attachment),/unavailable for body bmn/);
 await assert.rejects(availableEquipmentModels({...helmet,models:[attachment]},()=>false),/unavailable for body bmn/);
});
test('resource read failures are not mistaken for missing attachments',async()=>{
 await assert.rejects(availableEquipmentModels(helmet,()=>{throw Error('Access denied');}),/Access denied/);
});
test('exact face filename in the corrected directory is retained with its colors',async()=>{
 const wrong='art/dynamic/head/model/face_bhhelmet57_bmn_med_bh_a23_mask.gr2';
 const right=wrong.replace('/head/','/face/');
 const entry={...helmet,models:[helmet.models[0],wrong],colors:{[wrong]:{primary:'#abcdef'}}};
 const result=await availableEquipmentModels(entry,p=>p!==wrong);
 assert.deepEqual(result.models,[helmet.models[0],right]);
 assert.deepEqual(result.colors,{[right]:{primary:'#abcdef'}});
 assert.ok(result.warnings.some(w=>w.includes('Corrected equipment model directory')));
 assert.equal(equipmentModelAlternative(attachment),null);
 assert.equal(equipmentModelAlternative('art/dynamic/head/model/head_human_bmn.gr2'),null);
});
test('search assessment and conversion agree on unsupported bodies and partial selections',async()=>{
 const check=await inspectEquipmentModels(helmet,p=>p===helmet.models[0]);
 assert.equal(check.status,'partial');assert.equal(check.missing.length,1);
 const unavailable=await inspectEquipmentModels({...helmet,models:[attachment]},()=>false);
 assert.equal(unavailable.status,'unavailable');
 await assert.rejects(availableEquipmentModels({...helmet,body:'bfn',models:helmet.models.map(p=>p.replace('bmn','bfn'))},()=>false),/body bfn/);
});

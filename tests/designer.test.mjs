import test from 'node:test';
import assert from 'node:assert/strict';
import {designerCatalog,designerOptions,importNpcDesigner,validateDesigner,assembleDesigner} from '../src/designer.mjs';
import {validateState,defaultState,config} from '../src/backend.mjs';
import {equipmentSearch} from '../src/equipment.mjs';

test('removed saved appearance records are reported instead of silently replaced',async()=>{
 const value={species:'human',body:'bmn',choices:{appSlotHead:'0'.repeat(24)},colors:{}};
 await assert.rejects(assembleDesigner(config.resources,config.fixture,value),/Saved appearance choices are absent.*Head/);
 assert.equal(value.choices.appSlotHead,'0'.repeat(24));
});

test('all native player profiles retain head-dependent options and species labels',async()=>{
 const data=await designerCatalog();assert.equal(data.summary.productionRecords,208);assert.equal(Object.keys(data.profiles).length,104);
 for(const p of Object.values(data.profiles)){
  assert(p.heads.length);for(const h of p.heads){assert(data.entries[h]);assert(p.rules[h]);for(const ids of Object.values(p.rules[h]))for(const id of ids)assert(data.entries[id]);}
 }
 const {profile,groups}=await designerOptions({species:'togruta',body:'bfn'});
 assert.equal(profile.labels.appSlotHair,'Montrals and Lekku');assert(groups.appSlotHair.length>0);
 assert.equal((await designerOptions({species:'rattataki',body:'bmn'})).profile.labels.appSlotFaceHair,'Jewelry');
});
test('NPC import preserves facial-hair attachments and resets correctly on species changes',async()=>{
 const imported=await importNpcDesigner('16141108995265840656-0');
 assert(imported.selectedEntries.appSlotFaceHair['4611686031694070057'].includes(1312101));
 const changed=await designerOptions({...imported.designer,species:'togruta',choices:{},useNpcAppearance:false});
 assert.notEqual(changed.designer.choices.appSlotHead,imported.designer.choices.appSlotHead);
 assert(changed.groups.appSlotHair.length);
 const removed=await designerOptions({...imported.designer,choices:{...imported.designer.choices,appSlotFaceHair:null}});
 assert.equal(removed.selectedEntries.appSlotFaceHair,null);
});
test('native presets round-trip piece colors, reject unsafe selections, and retain legacy presets',()=>{
 const d={species:'human',body:'bmn',choices:{},colors:{'art/dynamic/chest/model/test.gr2':{primary:'#AA1234',secondary:'#FFDDEE'}}};
 const state=validateState({...defaultState,version:2,character:'native-designer',designer:d});
 assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))),state);
 assert.equal(validateState(defaultState).version,1);
 assert.throws(()=>validateDesigner({...d,sourceNpc:'../file'}));assert.throws(()=>validateDesigner({...d,choices:{appSlotHead:'not-in-catalog'}}));
 assert.throws(()=>validateDesigner({...d,colors:{head:{primary:'#XYZXYZ'}}}));
});
test('full outfit search returns actual localized piece names',async()=>{
 const result=await equipmentSearch({query:'Ablative Resinite Armor Set'});
 for(const category of ['chest','bracer','hand','waist','leg','boot','face'])assert(result.items.some(i=>i.category===category&&i.name.startsWith('Ablative Resinite')));
});

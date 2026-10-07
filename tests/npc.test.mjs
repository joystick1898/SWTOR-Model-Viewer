import test from 'node:test';
import assert from 'node:assert/strict';
import {filterNpcs,prepareNpc,npcRecord} from '../src/npc-catalog.mjs';
test('offline NPC search matches names and FQNs and pages without dropping variants',()=>{
 const items=Array.from({length:165},(_,i)=>({id:String(i),name:'Darth Malgus',fqn:'npc.event.malgus_'+i,variant:i,ready:true}));
 assert.equal(filterNpcs(items,'MALGUS').total,165);
 assert.equal(filterNpcs(items,'malgus',80).items.length,80);
 assert.equal(filterNpcs(items,'malgus',160).items.length,5);
 assert.equal(filterNpcs(items,'npc.event').total,165);
 assert.equal(filterNpcs(items,'nonexistent').total,0);
 assert.throws(()=>filterNpcs(items,'',-1),/Invalid/);
});
test('NPC selections and references cannot escape local resources',async()=>{
 await assert.rejects(npcRecord('../search?q=test'),/Invalid local/);
 for(const model of ['/art/../../private.gr2','C:/private.gr2','https://example.com/model.gr2'])await assert.rejects(prepareNpc('G:/Old Republic Assets/resources',{slots:[{models:[model]}]}),/outside resources/);
});

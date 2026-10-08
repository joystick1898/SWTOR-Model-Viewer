import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentSlot,reconcileEquipmentDraft} from '../src/renderer/equipment-layout.mjs';

test('equipment rows distinguish fitted clothing, hands, and independent attachments',()=>{
 assert.equal(equipmentSlot({bone:'@skin'},['art/dynamic/chest/[bt]/shirt.gr2']),'chest');
 assert.equal(equipmentSlot({bone:'@skin'},[],[{slot:'bracer'}]),'bracer');
 assert.equal(equipmentSlot({bone:'LeftWeapon'}),'off');
 assert.equal(equipmentSlot({bone:'RightWeapon'}),'main');
 assert.equal(equipmentSlot({bone:'socket_saber_left'},['art/dynamic/weapon/saber.gr2']),null);
 assert.equal(equipmentSlot({bone:'Spine2'}),null);
});

test('live transforms and unapplied colors merge without losing repeated layers or removals',()=>{
 const base=[0,1].map(()=>({item:'a',bone:'RightWeapon',position:[0,0,0],colors:{'*':{primary:'#112233'}}}));
 const draft=structuredClone(base);draft[1].colors['*'].primary='#445566';
 const incoming=structuredClone(base);incoming[1].position=[17,-9,8];
 const result=reconcileEquipmentDraft(base,draft,incoming);
 assert.deepEqual(result[1].position,[17,-9,8]);assert.equal(result[1].colors['*'].primary,'#445566');assert.equal(result[0].colors['*'].primary,'#112233');
 delete draft[1].colors;assert.equal(reconcileEquipmentDraft(base,draft,incoming)[1].colors,undefined);
 assert.equal(reconcileEquipmentDraft(base,[draft[0]],incoming).length,1);
 const newPreset=[{item:'b',bone:'Spine2'}];assert.deepEqual(reconcileEquipmentDraft(base,draft,newPreset),newPreset);
 assert.deepEqual(base[1].position,[0,0,0]);
});

test('removing the first identical layer retains the surviving layer identity',()=>{
 const base=[0,1].map(x=>({item:'a',bone:'RightWeapon',position:[x,0,0]}));
 const draft=structuredClone(base[1]);draft.colors={'*':{secondary:'#ABCDEF'}};
 const incoming=structuredClone(base);incoming[1].position=[42,0,0];
 const result=reconcileEquipmentDraft(base,[draft],incoming,[1]);
 assert.deepEqual(result[0].position,[42,0,0]);
 assert.deepEqual(result[0].colors,draft.colors);
 const added={item:'a',bone:'LeftWeapon',position:[7,0,0]};
 assert.deepEqual(reconcileEquipmentDraft(base,[added],incoming,[undefined]),[added]);
});

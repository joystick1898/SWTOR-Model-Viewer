import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEquipment,resolveEquipment,equipmentSearch} from '../src/equipment.mjs';
import {validateState,defaultState} from '../src/backend.mjs';
test('independent equipment layers survive presets including repeated items and unusual targets',()=>{
 const equipment=[{item:'a'.repeat(24),bone:'RightWeapon'},{item:'a'.repeat(24),bone:'socket_saber_left'},{item:'b'.repeat(24),bone:'LeftWeapon',rotation:[90,0,0]}];
 const saved=validateState({...defaultState,equipment});assert.equal(saved.equipment.length,3);assert.deepEqual(validateState(JSON.parse(JSON.stringify(saved))),saved);
 assert.throws(()=>validateEquipment([{item:'../x',bone:'Head'}]));assert.throws(()=>validateEquipment([{item:'a'.repeat(24),bone:'Head',scale:NaN}]));assert.throws(()=>validateEquipment([{item:'a'.repeat(24),bone:'Head',position:[0,Infinity,0]}]));
});
test('offline equipment search groups aliases and preserves two independent uses',async()=>{
 const result=await equipmentSearch({query:'blaster_high02_a03.gr2'});assert.ok(result.items.length);const id=result.items[0].id;
 const layers=await resolveEquipment([{item:id,bone:'RightWeapon'},{item:id,bone:'socket_saber_left'}]);assert.equal(layers.length,2);assert.equal(layers[0].models[0],layers[1].models[0]);assert.notEqual(layers[0].bone,layers[1].bone);
});

test('equipment accepts fractional transforms and unrestricted positive scales',()=>{
 const base={item:'a'.repeat(24),bone:'RightWeapon',position:[20001,.0007,-30000],rotation:[89.198280533,-2.917627966,7201.2345]};
 for(const scale of [1,.001,101]){const result=validateEquipment([{...base,scale}])[0];assert.equal(result.scale,scale);assert.deepEqual(result.rotation,base.rotation);assert.deepEqual(result.position,base.position);}
 for(const scale of [0,-1,Infinity,NaN])assert.throws(()=>validateEquipment([{...base,scale}]));
});

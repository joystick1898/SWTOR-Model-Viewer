import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateState,defaultState,nativeMotion,config,assets,previewAsset} from '../src/backend.mjs';
import {bodyProfiles,assembleCharacter,appearance} from '../src/character.mjs';
import {assetMetadata,assetMotion} from '../src/asset-metadata.mjs';
import {hexToHsl} from '../src/renderer/color.mjs';
import {readNativeJba} from '../tools/native-jba.mjs';
import {readNativeRig,mapBmnTracks} from '../tools/native-rig.mjs';
test('preset rejects invalid paths, invalid times, and unsupported modes',()=>{
  for(const patch of [{clip:'../evil.jba'},{clip:'ad_test.jba'},{time:NaN},{time:-1},{hidden:['x'.repeat(201)]},{version:2},{rootMotion:'true'},{weapon:'../bad.gr2'},{exportRig:'yes'}])assert.throws(()=>validateState({...defaultState,...patch}));
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(defaultState))),defaultState);
  const legacy={...defaultState};delete legacy.weapon;delete legacy.exportRig;assert.equal(validateState(legacy).weapon,'none');assert.equal(validateState(legacy).exportRig,true);
});

test('appearance validation and old presets preserve supported selections',()=>{
  const legacy={...defaultState};delete legacy.appearance;
  assert.deepEqual(validateState(legacy).appearance,defaultState.appearance);
  for(const patch of [{body:'../bmn'},{head:1.5},{hair:0},{hairHue:NaN},{skinBrightness:.9},{gearHue:'red'}])assert.throws(()=>appearance(patch));
  const custom={...defaultState,appearance:{body:'bfn',head:3,hair:12,gearHue:.65}};
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(validateState(custom)))),validateState(custom));
});

test('shared clip uses canonical bone order across all eight body skeletons',async()=>{
  const canonical=await nativeMotion(defaultState.clip,bodyProfiles.find(p=>p.id==='bmn'));
  for(const profile of bodyProfiles){
    const motion=await nativeMotion(defaultState.clip,profile);
    assert.equal(motion.sourceProfile,'bmnnew-102');
    assert.deepEqual(motion.names,canonical.names,profile.id);
    assert.deepEqual(motion.sourceBind,canonical.sourceBind,profile.id);
    assert.deepEqual(motion.motion,canonical.motion,profile.id);
    const assembly=await assembleCharacter(config.resources,config.fixture,{body:profile.id});
    assert.equal(assembly.profile.rig,profile.id+'new');
    for(const slot of assembly.slots)for(const model of slot.models)assert(model.includes('_'+profile.id+'_'),model);
  }
  const female=readNativeRig(fs.readFileSync(config.resources+'/anim/humanoid/bfnnew/anim_library.mph'));
  assert.notDeepEqual(mapBmnTracks(female,102).map(b=>b.name==='GOD'?'Bip01':b.name),canonical.names,'Fixture must detect the body-folder bone-order trap');
  await assert.rejects(nativeMotion('am_2p_argue_1.jba',bodyProfiles.find(p=>p.id==='bfn')),/verified source rig mapping/);
});

test('custom head, hair and native palettes resolve together',async()=>{
  const result=await assembleCharacter(config.resources,config.fixture,{body:'bfn',head:3,hair:12,hairHue:.08,eyeHue:.15,skinBrightness:.2,gearHue:.65});
  const slot=name=>result.slots.find(s=>s.slotName===name);
  assert(slot('head').models[0].endsWith('a03.gr2'));
  assert(slot('hair').models.every(p=>p.includes('_a12')));
  assert.equal(slot('head').materialInfo.eyeMatInfo.otherValues.palette1[0],.15);
  assert.equal(slot('hair').materialInfo.otherValues.palette1[0],.08);
  assert.equal(slot('chest').materialInfo.otherValues.palette1[0],.65);
});

test('asset catalog pages actual resources and rejects noncatalog paths',async()=>{
  const result=await assets({query:'blaster_high02_a03',category:'weapon'});
  assert(result.indexed>80000);assert(result.items.some(a=>a.id==='art/dynamic/weapon/blaster/blaster_high02_a03.gr2'));
  assert.equal((await assets({query:'blaster_high02_a03',offset:result.total})).items.length,0);
  await assert.rejects(assets({offset:-1}));
  await assert.rejects(previewAsset('../outside.gr2'),/not in the catalog/);
});

test('hex colors persist, reject malformed values and preserve native palette metadata',async()=>{
  assert.deepEqual(hexToHsl('#808080'),[0,0,128/255]);
  assert.deepEqual(hexToHsl('#FF0000'),[0,1,.5]);
  for(const value of ['red','#123','#GG0000',123])assert.throws(()=>appearance({hairColor:value}));
  const preset=validateState({...defaultState,appearance:{hairColor:'#482d18',eyeColor:'#588099',gearColor:'#8040c0'}});
  assert.equal(preset.appearance.gearColor,'#8040C0');
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(preset))),preset);
  const assembly=await assembleCharacter(config.resources,config.fixture,preset.appearance);
  assert.equal(assembly.slots.find(s=>s.slotName==='hair').materialInfo.otherValues.palette1Color,'#482D18');
  assert.equal(assembly.slots.find(s=>s.slotName==='chest').materialInfo.otherValues.palette1Color,'#8040C0');
});

test('walker links come from native index and spec, with complete native track mapping',async()=>{
  const metadata=await assetMetadata(config.resources,{id:'art/dynamic/creature/model/atst_walker_baron01.gr2',category:'creature'});
  assert.equal(metadata.profile,'atst');assert.equal(metadata.skeleton,'art/dynamic/spec/atst_skeleton.gr2');
  assert.equal(metadata.animationDirectory,'anim/droid/atst');assert.equal(metadata.clips.length,84);
  assert(metadata.materials.includes('art/shaders/materials/atst_walker_baron01_v01.mat'));
  assert.equal(metadata.unsupportedClips.length,0);
  for(const clip of metadata.clips){
    if(metadata.unsupportedClips.includes(clip)){await assert.rejects(assetMotion(config.resources,metadata,clip),/asset track mapping/);continue;}
    const motion=await assetMotion(config.resources,metadata,clip);assert.ok([28,30].includes(motion.tracks));assert.equal(motion.names.length,motion.tracks);
  }
  await assert.rejects(assetMotion(config.resources,metadata,'../evil.jba'));
  const mount=await assetMetadata(config.resources,{id:'art/dynamic/creature/model/atst_walker_mount01.gr2',category:'creature'});
  assert(mount.materials.length>1);
});
test('decoder rejects bad signatures and truncated native payloads',()=>{
  assert.throws(()=>readNativeJba(Buffer.alloc(88)));
  const b=fs.readFileSync('G:/Old Republic Assets/resources/anim/humanoid/bmnnew/cb_pistol_normal_to_combat.jba');
  for(const size of [8,87,1000,b.length-1])assert.throws(()=>readNativeJba(b.subarray(0,size)));
});
test('native bind and animation contain finite complete data with stable mapping',()=>{
  const base='G:/Old Republic Assets/resources/anim/humanoid/bmnnew/';
  const rig=readNativeRig(fs.readFileSync(base+'anim_library.mph'));
  const anim=readNativeJba(fs.readFileSync(base+'cb_pistol_normal_to_combat.jba'));
  const bones=mapBmnTracks(rig,anim.tracks);
  assert.equal(bones.length,102);assert.equal(bones[3].name,'Pelvis');assert.equal(bones.at(-1).name,'FxRoot');
  assert.equal(anim.worldTrackDecoded,true);assert.equal(anim.remainingBytes,0);
  assert.equal(anim.frames,9);assert(anim.world.translations.flat().every(Number.isFinite));
  assert.throws(()=>mapBmnTracks(rig,99));
});



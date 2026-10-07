import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {config,convertAsset} from '../src/backend.mjs';
import {assetMetadata,assetMotion} from '../src/asset-metadata.mjs';
import {writeUnityAssets} from '../src/unity-bundle.mjs';
test('creature source mapping and merged Hutt variants preserve native associations',async()=>{
 for(const profile of ['acklay','bantha','chevin','hutt']){
  const id=`art/dynamic/creature/model/${profile}_${profile}_a01.gr2`;
  const meta=await assetMetadata(config.resources,{id,category:'creature'});
  assert.ok(meta.animationSupported);const clip=meta.clips.find(c=>c==='mv_walk_forward.jba')||meta.clips[0];
  const motion=await assetMotion(config.resources,meta,clip);assert.equal(motion.names.length,motion.tracks);assert.equal(new Set(motion.names).size,motion.tracks);
  if(profile==='hutt'){assert.ok(meta.materials.length>=5);assert.ok(Object.values(meta.materialOverrides).some(v=>v.some(s=>s.includes('eye_'))));}
 }
});
test('asset export rejects invalid selections before conversion',async()=>{
 for(const selection of [{time:-1},{time:NaN},{time:3601},{exportRig:'yes'}])await assert.rejects(convertAsset('unused',selection,'fbx'),/Invalid export pose/);
 await assert.rejects(convertAsset('unused',{},'bad'),/Unknown conversion mode/);
});
test('asset conversion locks before catalog lookup and releases after rejection',async()=>{
 const first=convertAsset('../missing-review-resource.gr2');
 const firstRejected=assert.rejects(first,/not in the catalog/);
 await assert.rejects(convertAsset('../second-review-resource.gr2'),/already running/);
 await firstRejected;
 await assert.rejects(convertAsset('../retry-review-resource.gr2'),/not in the catalog/);
});
test('Unity materials mark normals and retain GUIDs on repeated exports',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'swtor-unity-test-'));
 try{
  const dest=path.join(folder,'model.fbx'),manifest={rigged:true,materials:[{name:'Hair',textures:{base:'base.png',normal:'normal.png',emission:'emission.png'},alphaMode:'cutout',alphaCutoff:.75}]};
  await writeUnityAssets(dest,manifest);
  const before=await fs.readFile(dest+'.meta','utf8'),normal=await fs.readFile(path.join(folder,'normal.png.meta'),'utf8');
  assert.match(normal,/textureType: 1/);assert.match(normal,/sRGBTexture: 0/);
  assert.match(await fs.readFile(path.join(folder,'model.materials/Hair.mat'),'utf8'),/_Cutoff: 0.75/);
  await writeUnityAssets(dest,manifest);assert.equal(await fs.readFile(dest+'.meta','utf8'),before);
 }finally{await fs.rm(folder,{recursive:true});}
});

import {readNativeNetwork} from '../tools/native-rig.mjs';
import {animationLibrary,decodeAssetMotion} from '../src/animation-library.mjs';
test('native network maps include reduced-track creatures and all walker clips',async()=>{
 for(const [directory,file,count] of [['anim/creature/basiliskbuddy','anim_library.mph',38],['anim/creature/mote','mote_loco.mph',2],['anim/droid/atst','anim_library.mph',28]]){
  const bytes=await fs.readFile(path.join(config.resources,directory,file)),network=readNativeNetwork(bytes);
  assert.ok(network.clips.some(c=>c.bones.length===count));assert.throws(()=>readNativeNetwork(bytes.subarray(0,100)));
  const library=await animationLibrary(config.resources,directory);assert.equal(library.unsupported.length,0);
 }
});
test('stale body-network order is corrected by its observed native bind fingerprint',async()=>{
 const motion=await decodeAssetMotion(config.resources,'anim/humanoid/bfbnew','dg_death_back_7.jba');
 assert.equal(motion.names[44],'LeftCollar');assert.ok(motion.mappingCorrection.error<.01);
});


test('shared 105-track attacks use their proven source bind on female bodies',async()=>{
 const clip='cb_2saber_attack_right_1.jba';
 const male=await decodeAssetMotion(config.resources,'anim/humanoid/bmnnew',clip);
 for(const body of ['bfa','bfn','bfs','bfb']){
  const motion=await decodeAssetMotion(config.resources,`anim/humanoid/${body}new`,clip);
  assert.equal(motion.tracks,105);assert.equal(motion.sourceProfile,'anim/humanoid/bmnnew');assert.deepEqual(motion.sourceBind,male.sourceBind);
  for(const name of ['RightShoulder','LeftShoulder','RightElbow','LeftElbow']){const i=motion.names.indexOf(name);assert(i>=0);const bind=motion.sourceBind[i].translation;const error=Math.max(...motion.motion[i].translations.map(t=>Math.hypot(...t.map((v,j)=>v-bind[j]))));assert(error<.001,`${body} ${name}: ${error}`);}
 }
});

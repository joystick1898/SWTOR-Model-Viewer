import test from 'node:test';
import assert from 'node:assert/strict';
import {expressionLibrary,validateExpression} from '../src/expressions.mjs';
import {config,defaultState,validateState} from '../src/backend.mjs';
test('expression state validates and survives preset serialization',()=>{
 assert.equal(validateState({...defaultState,expression:'ad_face_joy_pose_01.jba'}).expression,'ad_face_joy_pose_01.jba');
 assert.equal(validateExpression(undefined),null);
 assert.equal(validateState({...defaultState,expression:'neutral'}).expression,'neutral');
 assert.throws(()=>validateExpression('../ad_face_joy_pose_01.jba'));
 assert.throws(()=>validateExpression('cb_pistol_idle.jba'));
});
test('native expression poses have explicit facial mappings and additive payloads',async()=>{
 for(const body of ['bmn','bfn','bfa']){
 const poses=await expressionLibrary(config.resources,`anim/humanoid/${body}new`);
 assert(poses.length>20);
 const joy=poses.find(p=>p.id==='ad_face_joy_pose_01.jba');assert(joy);
 assert(joy.tracks.every(t=>t.name.startsWith('fc_')));
 assert(joy.tracks.some(t=>Math.hypot(...t.translation)>.1));
 assert(joy.tracks.every(t=>t.translation.every(Number.isFinite)&&t.rotation.every(Number.isFinite)));
 }
});

import {decodeAssetMotion} from '../src/animation-library.mjs';
test('small female stealth idle uses matching neutral facial bind without replacing body rig',async()=>{
 const m=await decodeAssetMotion(config.resources,'anim/humanoid/bfanew','cb_2saber_stealth_idle_1.jba');
 assert.equal(m.facialSourceBind.profile,'bfnnew');assert.equal(m.sourceProfile,'anim/humanoid/bfanew');
 for(const [i,name] of m.names.entries())if(name.startsWith('fc_')&&!name.startsWith('fc_wrinkle')){
  for(const t of m.motion[i].translations)assert(Math.hypot(...t.map((v,j)=>v-m.sourceBind[i].translation[j]))<.001);
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBlade,validateEquipment} from '../src/equipment.mjs';
import {editableBlade,saberGroups,saberElements} from '../src/saber-layout.mjs';
test('manual saber layouts allow all 16 combinations and preserve independent elements',()=>{
 for(let mask=0;mask<16;mask++){
  const b=editableBlade();saberGroups.forEach(([key],i)=>b.layout[key]=Boolean(mask&(1<<i)));
  b.elements.straightLeft.position=[1.25,-4,2];b.elements.diagonalRight.rotation=[0,30,-12.5];b.elements.dual.glow='#aabbcc';b.elements.single.core='#112233';
  const result=validateBlade(b);assert.equal(result.enabled,mask!==0);assert.deepEqual(result.layout,b.layout);
  assert.deepEqual(result.elements,b.elements);assert.deepEqual(validateBlade(JSON.parse(JSON.stringify(result))),result);
  const layer=validateEquipment([{item:'a'.repeat(24),bone:'RightWeapon',blade:result}])[0];assert.deepEqual(layer.blade,result);
 }
});
test('manual elements reject invalid transforms, colors and dimensions',()=>{
 for(const patch of [{position:[0,NaN,0]},{rotation:[1,2]},{length:0},{width:Infinity},{glow:'red'},{intensity:-1}]){
  const b=editableBlade();Object.assign(b.elements.diagonalLeft,patch);assert.throws(()=>validateBlade(b));
 }
 const b=editableBlade();b.layout.straight='yes';assert.throws(()=>validateBlade(b));
});
test('legacy saber settings remain valid and editing migrates main blades without enabling guards',()=>{
 const old={enabled:true,core:'#ff0000',glow:'#00ff00',length:72,width:1.5};
 assert.equal(validateBlade(old).layout,undefined);
 const edited=editableBlade(old,true);assert.deepEqual(edited.layout,{single:true,dual:true,straight:false,diagonal:false});
 assert.equal(edited.elements.single.length,72);assert.equal(edited.elements.straightLeft.glow,'#00ff00');assert.equal(saberElements.length,6);
});
test('saber colors and independent dimensions survive equipment saves',()=>{
 const blade={enabled:true,core:'#221100',glow:'#00AAFF',length:43.125,width:4.25};
 const r=validateEquipment([{item:'a'.repeat(24),bone:'LeftWeapon',blade}])[0];assert.deepEqual(r.blade,{...blade,effect:'native',spacing:0,motion:'static',frame:0,intensity:1.5,glow:'#00aaff'});
 assert.equal(validateBlade({...blade,enabled:false}).enabled,false);
 for(const bad of [{length:0},{width:-1},{length:Infinity},{core:'red'},{enabled:'yes'},{effect:'unknown'},{spacing:Infinity}])assert.throws(()=>validateBlade({...blade,...bad}));
});

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {writeUnityAssets} from '../src/unity-bundle.mjs';
test('Unity saber bundle uses its shader with opaque core and additive depth-safe glow',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'saber-export-'));
 try{
  const materials=['core','glow'].map(channel=>({name:'Saber '+channel,family:'Saber',saberChannel:channel,saberEffect:'unstable',alphaMode:channel==='core'?'opaque':'blend',textures:{base:channel+'.png',normal:channel+'-n.png',emission:channel+'-e.png'}}));
  await writeUnityAssets(path.join(directory,'test.fbx'),{rigged:true,materials});
  const folder=path.join(directory,'test.materials');
  const shader=await fs.readFile(path.join(folder,'SWTORSaber.shader'),'utf8');assert.match(shader,/Cull Back/);assert.match(shader,/float4 frag/);assert.match(shader,/_Intensity/);assert.match(shader,/Blend \[_SrcBlend\] \[_DstBlend\]/);
  const core=await fs.readFile(path.join(folder,'Saber core.mat'),'utf8'),glow=await fs.readFile(path.join(folder,'Saber glow.mat'),'utf8');
  for(const material of [core,glow]){assert.match(material,/fileID: 4800000/);assert.match(material,/_Effect: 1/);assert.match(material,/_Intensity: 1\.5/);}
  assert.match(core,/_ZWrite: 1/);assert.match(core,/_DstBlend: 0/);assert.match(glow,/_ZWrite: 0/);assert.match(glow,/_DstBlend: 1/);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('blade spacing persists inward and outward offsets',()=>{for(const spacing of [-8,0,12.5])assert.equal(validateBlade({enabled:true,spacing}).spacing,spacing);});

test('persistent families, static frames and script-free animation survive saves',async()=>{
 for(const effect of ['native','standard','unstable','relic','vented','vintage','mamba','tau','nul']){
  for(const motion of ['static','animated']){
   const b=validateBlade({enabled:true,effect,motion,frame:31});assert.equal(b.effect,effect);assert.equal(b.motion,motion);assert.equal(b.frame,31);assert.deepEqual(validateBlade(JSON.parse(JSON.stringify(b))),b);
  }
 }
 assert.equal(validateBlade({enabled:true,effect:'pulsing'}).effect,'standard');
 for(const patch of [{motion:'trail'},{frame:-1},{frame:1.5},{frame:1024}])assert.throws(()=>validateBlade({enabled:true,...patch}));
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'native-saber-'));
 try{
  const surface={name:'Saber FX test',family:'SaberFX',alphaMode:'blend',textures:{base:'atlas.png',emission:'atlas.png',normal:'normal.png'},saberFX:{columns:16,rows:2,frame:31,fps:12.5,direction:1,animated:true}};
  await writeUnityAssets(path.join(directory,'test.fbx'),{rigged:false,materials:[surface]});
  const material=await fs.readFile(path.join(directory,'test.materials','Saber FX test.mat'),'utf8');
  assert.match(material,/fileID: 4800000/);assert.match(material,/_Columns: 16/);assert.match(material,/_Rows: 2/);assert.match(material,/_FPS: 12.5/);assert.match(material,/_SrcBlend: 5/);assert.match(material,/_DstBlend: 10/);assert.match(material,/_ZWrite: 0/);
  const shader=await fs.readFile(path.join(directory,'test.materials','SWTORSaberFX.shader'),'utf8');assert.match(shader,/_Time.y\*_FPS/);assert.match(shader,/Cull \[_Cull\]/);
  assert.match(await fs.readFile(path.join(directory,'atlas.png.meta'),'utf8'),/enableMipMap: 0/);
  surface.saberFX.animated=false;await writeUnityAssets(path.join(directory,'test.fbx'),{rigged:false,materials:[surface]});
  assert.match(await fs.readFile(path.join(directory,'test.materials','Saber FX test.mat'),'utf8'),/_FPS: 0/);
  assert(!(await fs.readdir(path.join(directory,'test.materials'))).some(n=>n.endsWith('.cs')));
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('new saber defaults use softer emission and narrow crossguards',()=>{
 const b=validateBlade(editableBlade());
 for(const [key] of saberElements){assert.equal(b.elements[key].intensity,1.5);assert.equal(b.elements[key].width,key==='single'||key==='dual'?2:1);}
 b.elements.diagonalLeft.width=1.7;b.elements.diagonalLeft.intensity=2.3;
 assert.equal(validateBlade(b).elements.diagonalLeft.width,1.7);
 assert.equal(validateBlade(b).elements.diagonalLeft.intensity,2.3);
});

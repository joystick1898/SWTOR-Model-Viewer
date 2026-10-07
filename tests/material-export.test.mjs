import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {writeUnityAssets} from '../src/unity-bundle.mjs';
test('colliding Windows material names retain distinct stable Unity remaps',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'swtor-material-collisions-'));
 try{
  const destination=path.join(folder,'model.fbx');
  const names=['Armor/A','Armor:A','Hair','hair'];
  const materials=names.map(name=>({name,textures:{base:'base.png',normal:'normal.png',emission:'emission.png'}}));
  await writeUnityAssets(destination,{materials});
  const files=(await fs.readdir(path.join(folder,'model.materials'))).filter(name=>name.endsWith('.mat'));
  assert.equal(files.length,names.length);
  const modelMeta=await fs.readFile(destination+'.meta','utf8');
  const remaps=[...modelMeta.matchAll(/second: \{fileID: 2100000, guid: ([a-f0-9]+)/g)].map(match=>match[1]);
  assert.equal(new Set(remaps).size,names.length);
  const exportedNames=await Promise.all(files.map(async file=>JSON.parse((await fs.readFile(path.join(folder,'model.materials',file),'utf8')).match(/m_Name: (.+)/)[1])));
  assert.deepEqual(exportedNames.sort(),[...names].sort());
  await writeUnityAssets(destination,{materials});
  assert.equal(await fs.readFile(destination+'.meta','utf8'),modelMeta);
 }finally{await fs.rm(folder,{recursive:true,force:true});}
});
test('native matte export retains large dimensions without reflection maps',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'swtor-material-'));
 try{
  const surface={name:'Armor',textures:{base:'base.png',normal:'normal.png',emission:'emission.png'},textureDimensions:{normal:[4096,2048]},alphaMode:'cutout',alphaCutoff:.75};
  await writeUnityAssets(path.join(folder,'model.fbx'),{materials:[surface]});
  const mat=await fs.readFile(path.join(folder,'model.materials/Armor.mat'),'utf8');
  assert.doesNotMatch(mat,/_SPECGLOSSMAP|_SpecGlossMap:/);assert.match(mat,/_Glossiness: 0.35/);assert.match(mat,/_SpecColor: \{r: 0, g: 0, b: 0/);assert.doesNotMatch(mat,/undefined/);
  const normal=await fs.readFile(path.join(folder,'normal.png.meta'),'utf8');
  assert.match(normal,/maxTextureSize: 4096/);assert.match(normal,/npotScale: 0/);
  assert.match(normal,/sRGBTexture: 0/);assert.match(normal,/textureCompression: 0/);
 }finally{await fs.rm(folder,{recursive:true,force:true});}
});
test('static vent overlay keeps additive blending without a new shader',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'swtor-vent-'));
 try{
  await writeUnityAssets(path.join(folder,'vent.fbx'),{materials:[{name:'Vent',family:'EmissiveOnly',alphaMode:'additive',textures:{base:'b.png',normal:'n.png',emission:'e.png'},specular:0}]});
  const mat=await fs.readFile(path.join(folder,'vent.materials/Vent.mat'),'utf8');
  assert.match(mat,/fileID: 200,/);assert.match(mat,/_SrcBlend: 1/);assert.match(mat,/_DstBlend: 1/);assert.match(mat,/_ZWrite: 0/);assert.match(mat,/m_CustomRenderQueue: 3000/);
 }finally{await fs.rm(folder,{recursive:true,force:true});}
});

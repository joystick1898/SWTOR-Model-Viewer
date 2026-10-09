import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {writeZGPackage,zgFolderName} from '../src/zg-export.mjs';

const fixture=()=>({paths:[{slotName:'head',models:['/art/head.gr2'],materialInfo:{}}],skeleton:{path:'/art/rig.gr2'},preset:{},warnings:[],colorsTranslated:0,dependencies:{},recoveredResources:[]});
test('ZG package keeps exact legacy filenames and does not overwrite an export',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'zg-package-'));
  try{
    const destination=path.join(root,'Character'),data=fixture();
    const saved=await writeZGPackage(data,destination);
    assert.deepEqual(JSON.parse(await fs.readFile(saved.file,'utf8')),data.paths);
    assert.deepEqual((await fs.readdir(path.join(destination,'assets'))).sort(),['paths.json','preset.json','skeleton.json']);
    await assert.rejects(writeZGPackage(data,destination),/not overwritten/);
    assert.equal((await fs.readdir(root)).length,1);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('recovered dependencies create a usable Resources tree; failed writes leave no package',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'zg-recovery-'));
  try{
    const source=path.join(root,'model');await fs.writeFile(source,'fixture');
    const data={...fixture(),dependencies:{'art/test.gr2':source},recoveredResources:['art/test.gr2']};
    const saved=await writeZGPackage(data,path.join(root,'Character'));
    assert.equal(await fs.readFile(path.join(saved.folder,'Resources/art/test.gr2'),'utf8'),'fixture');
    assert.equal(saved.bundledResources,true);
    data.dependencies={'../escape':source};
    await assert.rejects(writeZGPackage(data,path.join(root,'Failed')),/Invalid resource/);
    assert.deepEqual((await fs.readdir(root)).sort(),['Character','model']);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('generated folder names are filesystem safe and distinct',()=>{
  const first=zgFolderName('NPC:/<>|*?.');
  assert.doesNotMatch(first,/[<>:"/\\|?*]/);
  assert.notEqual(first,zgFolderName('NPC:/<>|*?.'));
});

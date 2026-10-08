import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {cachePolicy,cleanCache,cleanSnapshots,storageUsage,claimStorage} from '../src/cache-policy.mjs';
import {readCachedConversion} from '../src/conversion-cache.mjs';
import {writeExportBundle} from '../src/export-bundle.mjs';
const exists=file=>fs.access(file).then(()=>true,()=>false);
async function fixture(run){const root=await fs.mkdtemp(path.join(os.tmpdir(),'swtor-cache-test-'));try{await run(root);}finally{await fs.rm(root,{recursive:true,force:true});}}
async function conversion(root,name,textures=[],age=0,ext='glb'){
  const folder=path.join(root,'app-cache',name);await fs.mkdir(folder,{recursive:true});
  const file=path.join(folder,'preview.'+ext);await fs.writeFile(file,Buffer.alloc(100));
  await fs.writeFile(path.join(folder,'result.json'),JSON.stringify({file,textureFiles:textures}));
  const used=new Date(Date.now()-age*86400000);await fs.utimes(folder,used,used);return folder;
}
async function material(root){const folder=path.join(root,'material-cache','shared');await fs.mkdir(folder,{recursive:true});const file=path.join(folder,'base.png');await fs.writeFile(file,Buffer.alloc(100));return file;}
test('defaults and validation include zero-retention mode',()=>{
  assert.equal(cachePolicy().limitGiB,2);assert.equal(cachePolicy({limitGiB:0}).limitGiB,0);
  for(const value of [-1,NaN,Infinity,1025,'2'])assert.throws(()=>cachePolicy({limitGiB:value}));
  assert.throws(()=>cachePolicy({maxAgeDays:0}));assert.throws(()=>cachePolicy({clearOnExit:'yes'}));
});
test('size eviction respects last use and shared material dependencies',()=>fixture(async root=>{
  const texture=await material(root),old=await conversion(root,'old',[texture],2),recent=await conversion(root,'recent',[texture]);
  const before=await storageUsage(root);const oldBytes=(await fs.stat(path.join(old,'result.json'))).size+100;
  const after=await cleanCache(root,{limitGiB:(before.cacheBytes-oldBytes)/1024**3});
  assert.equal(await exists(old),false);assert.equal(await exists(recent),true);assert.equal(await exists(texture),true);
  assert.ok(after.cacheBytes<=before.cacheBytes-oldBytes);
  await cleanCache(root,{limitGiB:0});assert.equal(await exists(recent),false);assert.equal(await exists(texture),false);
}));
test('cache hit refreshes age; expired, broken and intermediate exports are removed',()=>fixture(async root=>{
  const expired=await conversion(root,'expired',[],20),reused=await conversion(root,'reused',[],20);
  assert.ok(await readCachedConversion(path.join(reused,'result.json')));
  const broken=await conversion(root,'broken',[path.join(root,'missing.png')]),exported=await conversion(root,'export',[],0,'fbx');
  const partial=path.join(root,'asset-cache','partial');await fs.mkdir(partial,{recursive:true});await fs.writeFile(path.join(partial,'request.json'),'{}');
  await cleanCache(root);
  for(const folder of [expired,broken,exported,partial])assert.equal(await exists(folder),false);
  assert.equal(await exists(reused),true);
}));
test('clear retains catalogs, recovered resources, and user exports',()=>fixture(async root=>{
  await conversion(root,'preview');await material(root);
  for(const file of ['designer/catalog.json','npc-resources/art/a.gr2','my-export.fbx','preset.json']){await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),'keep');}
  const result=await cleanCache(root,{},true);assert.equal(result.cacheBytes,0);assert.equal(result.requiredBytes,16);
}));
test('cleanup rejects linked trees without touching their targets',()=>fixture(async root=>{
  const external=path.join(root,'external'),data=path.join(root,'data');await fs.mkdir(external);await fs.writeFile(path.join(external,'keep'),'keep');await fs.mkdir(data);
  await fs.symlink(external,path.join(data,'app-cache'),'junction');
  await assert.rejects(cleanCache(data),/Linked/);assert.equal(await exists(path.join(external,'keep')),true);
}));
test('obsolete snapshots are removed while active and unrelated directories survive',()=>fixture(async root=>{
  const active=path.join(root,'1111111111111111-11111111'),old=path.join(root,'2222222222222222-22222222'),failed=path.join(root,'3333333333333333-33333333'),other=path.join(root,'unrelated');
  for(const folder of [active,old,failed,other]){await fs.mkdir(folder);await fs.writeFile(path.join(folder,folder===failed?'failure.txt':'ready.json'),'{}');}
  await cleanSnapshots(root,active);
  assert.equal(await exists(active),true);assert.equal(await exists(other),true);assert.equal(await exists(old),false);assert.equal(await exists(failed),false);
}));
test('storage cannot be shared by independent user configurations',()=>fixture(async root=>{
  await claimStorage(root,path.join(root,'home'));await claimStorage(root,path.join(root,'home'));
  await assert.rejects(claimStorage(root,path.join(root,'other-home')),/another viewer/);
}));
test('delivered preview bytes and completed export bundles survive zero-retention cleanup',()=>fixture(async root=>{
  const texture=await material(root),preview=await conversion(root,'preview',[texture]),exported=await conversion(root,'export',[texture],0,'fbx');
  const bytes=await fs.readFile(path.join(preview,'preview.glb'));
  const result=JSON.parse(await fs.readFile(path.join(exported,'result.json'),'utf8'));
  result.materialDetails=[];result.rigged=false;
  const destination=path.join(root,'saved','model.fbx');
  await writeExportBundle(result,{},destination);
  await cleanCache(root,{limitGiB:0});
  assert.equal(bytes.length,100);assert.equal(await exists(preview),false);assert.equal(await exists(exported),false);
  assert.equal((await fs.stat(destination)).size,100);assert.equal((await fs.stat(path.join(root,'saved/model.textures/base.png'))).size,100);
  assert.equal(await exists(destination+'.json'),true);
}));

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {readCachedConversion} from '../src/conversion-cache.mjs';

test('conversion caches recover from interrupted output and missing companions',async()=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'swtor-conversion-cache-'));
  try{
    const file=path.join(folder,'model.fbx'),texture=path.join(folder,'base.png'),reportPath=path.join(folder,'result.json');
    const report={file,textureFiles:[texture]};
    await fs.writeFile(file,'model');
    assert.equal(await readCachedConversion(reportPath,file),null);
    await fs.writeFile(reportPath,'{');
    assert.equal(await readCachedConversion(reportPath,file),null);
    await fs.writeFile(reportPath,JSON.stringify(report));
    assert.equal(await readCachedConversion(reportPath,file),null);
    await fs.writeFile(texture,'texture');
    assert.deepEqual(await readCachedConversion(reportPath,file),report);
    assert.equal(await readCachedConversion(reportPath,path.join(folder,'other.fbx')),null);
    await fs.writeFile(file,'');
    assert.equal(await readCachedConversion(reportPath,file),null);
    await fs.writeFile(file,'model');
    await fs.unlink(texture);
    assert.equal(await readCachedConversion(reportPath,file),null);
  }finally{await fs.rm(folder,{recursive:true,force:true});}
});

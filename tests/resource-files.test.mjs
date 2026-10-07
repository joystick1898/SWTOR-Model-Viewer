import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
test('reconciled reads preserve extracted art, refresh indexes, and expose recovered assets',async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'swtor-source-view-'));
  const root=path.join(temp,'resources'),data=path.join(temp,'data'),overlay=path.join(data,'npc-resources');
  try{
    for(const directory of [root,overlay])await fs.mkdir(path.join(directory,'art/model'),{recursive:true});
    await fs.writeFile(path.join(root,'art/model/old.gr2'),'extracted art');
    await fs.writeFile(path.join(overlay,'art/model/old.gr2'),'overlay copy');
    await fs.writeFile(path.join(overlay,'art/model/new.gr2'),'recovered art');
    await fs.writeFile(path.join(root,'art/model/index.xml'),'old index');
    await fs.writeFile(path.join(overlay,'art/model/index.xml'),'current index');
    const code=`import fs from ${JSON.stringify(new URL('../src/resource-files.mjs',import.meta.url).href)};
      import path from 'node:path';
      const root=process.env.SWTOR_RESOURCES;
      const content=await Promise.all(['old.gr2','new.gr2','index.xml'].map(n=>fs.readFile(path.join(root,'art/model',n),'utf8')));
      console.log(JSON.stringify({content,files:await fs.readdir(path.join(root,'art/model'))}));`;
    const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',code],{env:{...process.env,SWTOR_PACKAGED:'1',SWTOR_RESOURCES:root,SWTOR_DATA:data,SWTOR_GAME:''},windowsHide:true});
    const result=JSON.parse(stdout);assert.deepEqual(result.content,['extracted art','recovered art','current index']);assert.deepEqual(result.files.sort(),['index.xml','new.gr2','old.gr2']);
    assert.equal(await fs.readFile(path.join(root,'art/model/index.xml'),'utf8'),'old index');
  }finally{await fs.rm(temp,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fingerprint,validateSources,readSettings,writeSettings,prepareData,validateCatalogs} from '../src/setup.mjs';

test('resource changes invalidate a snapshot even when version.txt is unchanged',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'viewer-snapshot-'));
  try{
    const resources=path.join(root,'resources'),game=path.join(root,'game');
    for(const dir of ['art/dynamic','anim','gamedata','systemgenerated/buckets'])await fs.mkdir(path.join(resources,dir),{recursive:true});
    await fs.writeFile(path.join(resources,'systemgenerated/client.gom'),'test');
    await fs.writeFile(path.join(resources,'version.txt'),'dbVersion=1');
    await fs.mkdir(path.join(game,'Assets'),{recursive:true});
    for(const name of ['swtor_main_test.tor','swtor_en-us_global_1.tor'])await fs.writeFile(path.join(game,'Assets',name),'test');
    const sources=await validateSources({resources,game});
    const first=await fingerprint(sources);assert.equal((await fingerprint(sources)).id,first.id);
    const file=path.join(resources,'art/dynamic/new.gr2');await fs.writeFile(file,'mesh');
    const added=await fingerprint(sources);assert.notEqual(added.id,first.id);
    await fs.writeFile(file,'changed mesh');assert.notEqual((await fingerprint(sources)).id,added.id);
    await fs.unlink(file);assert.equal((await fingerprint(sources)).id,first.id);
    await fs.writeFile(path.join(game,'Assets/swtor_main_test.tor'),'new game data');assert.notEqual((await fingerprint(sources)).id,first.id);
    await assert.rejects(validateSources({resources:game,game}),/Resources folder/);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('failed or cancelled preparation never publishes a replacement setup',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'viewer-failed-build-'));
  try{
    const resources=path.join(root,'resources'),game=path.join(root,'game'),home=path.join(root,'home');
    for(const dir of ['art/dynamic','anim','gamedata','systemgenerated/buckets'])await fs.mkdir(path.join(resources,dir),{recursive:true});
    await fs.writeFile(path.join(resources,'systemgenerated/client.gom'),'test');
    await fs.writeFile(path.join(resources,'version.txt'),'dbVersion=1');
    await fs.mkdir(path.join(game,'Assets'),{recursive:true});
    for(const name of ['swtor_main_test.tor','swtor_en-us_global_1.tor'])await fs.writeFile(path.join(game,'Assets',name),'test');
    await fs.mkdir(path.join(root,'tools'));
    // Node as a deliberately failing worker verifies the process boundary and rollback.
    await fs.writeFile(path.join(root,'tools/check_sources.py'),"throw Error('unsupported archive format')");
    await writeSettings(home,{resources:'original',data:'original-data'});
    const options={home,project:root,runtime:{python:process.execPath,blender:process.execPath,addons:root},sources:{resources,game}};
    await assert.rejects(prepareData(options),/preparation failed/);
    assert.equal((await readSettings(home)).data,'original-data');
    const controller=new AbortController();controller.abort();
    await assert.rejects(prepareData({...options,signal:controller.signal}),/abort/i);
    assert.equal((await readSettings(home)).resources,'original');
    await assert.rejects(validateCatalogs(root));
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('settings publication preserves the previous selection until a replacement is saved',async()=>{
  const home=await fs.mkdtemp(path.join(os.tmpdir(),'viewer-settings-'));
  try{
    assert.equal(await readSettings(home),null);
    await writeSettings(home,{resources:'first',data:'old'});
    await fs.writeFile(path.join(home,'incomplete.tmp'),'partial');
    assert.equal((await readSettings(home)).resources,'first');
    await writeSettings(home,{resources:'second',data:'new'});
    assert.equal((await readSettings(home)).data,'new');
    await fs.writeFile(path.join(home,'settings.json'),'broken');
    await assert.rejects(readSettings(home),/Settings could not be read/);
  }finally{await fs.rm(home,{recursive:true,force:true});}
});
test('mixed versions and later game updates publish fresh catalogs automatically',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'viewer-auto-refresh-'));
  try{
    const resources=path.join(root,'resources'),game=path.join(root,'game'),home=path.join(root,'home');
    for(const dir of ['art/dynamic','anim','gamedata','systemgenerated/buckets'])await fs.mkdir(path.join(resources,dir),{recursive:true});
    await fs.writeFile(path.join(resources,'systemgenerated/client.gom'),'test');
    await fs.writeFile(path.join(resources,'version.txt'),'compatibleClient=old');
    await fs.mkdir(path.join(game,'Assets'),{recursive:true});
    for(const name of ['swtor_main_test.tor','swtor_en-us_global_1.tor'])await fs.writeFile(path.join(game,'Assets',name),'test');
    await fs.mkdir(path.join(root,'tools'));
    await fs.writeFile(path.join(root,'tools/check_sources.py'),`console.log(JSON.stringify({mismatch:true,resources:{compatibleClient:'old'},game:{compatibleClient:'new'}}))`);
    const catalogs={
      build_local_npcs:['local-npcs/catalog.json',{items:[{ready:true,id:'new-record'}]}],
      build_equipment:['equipment/catalog.json',{items:[{id:'new-equipment'}]}],
      build_designer:['designer/catalog.json',{profiles:{'human:bmn':{}},entries:{}}],
      build_designer_labels:['designer/labels.json',{option:{label:'Native'}}],
      build_asset_names:['asset-names.json',{names:{'art/model/new.gr2':['New item']}}],
    };
    for(const [script,[file,value]] of Object.entries(catalogs))await fs.writeFile(path.join(root,'tools',script+'.py'),`const fs=require('node:fs'),path=require('node:path');const file=path.join(process.env.SWTOR_DATA,${JSON.stringify(file)});fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,${JSON.stringify(JSON.stringify(value))});`);
    const options={home,project:root,runtime:{python:process.execPath,blender:process.execPath,addons:root},sources:{resources,game}};
    const first=await prepareData(options);assert.equal(first.sourceCheck.mismatch,true);
    assert.equal((await prepareData(options)).data,first.data,'unchanged data should reuse the completed snapshot');
    const tuned=await prepareData({...options,storage:{cache:{limitGiB:0.5,maxAgeDays:7,clearOnExit:true}}});
    assert.equal(tuned.data,first.data,'cache preference changes should not rebuild');
    assert.deepEqual((await readSettings(home)).cache,{limitGiB:0.5,maxAgeDays:7,clearOnExit:true});
    await fs.writeFile(path.join(game,'Assets/swtor_main_test.tor'),'updated game contents');
    const next=await prepareData(options);assert.notEqual(next.data,first.data);
    assert.equal((await readSettings(home)).data,next.data);
    assert.equal(JSON.parse(await fs.readFile(path.join(next.data,'equipment/catalog.json'),'utf8')).items[0].id,'new-equipment');
    await fs.access(path.join(first.data,'ready.json'));
    const relocated=await prepareData({...options,storage:{storageHome:path.join(root,'other-drive')}});
    assert.equal(path.dirname(relocated.data),path.join(root,'other-drive','snapshots'));
    assert.equal(relocated.previousSnapshot,next.data);assert.equal(relocated.cache.limitGiB,0.5);
    await fs.access(path.join(next.data,'ready.json'));
    await assert.rejects(prepareData({...options,storage:{storageHome:path.join(resources,'cache')}}),/outside game/);
    const alias=path.join(root,'resource-alias');await fs.symlink(resources,alias,'junction');
    await assert.rejects(prepareData({...options,storage:{storageHome:path.join(alias,'cache')}}),/outside game/);
    assert.equal(await fs.access(path.join(resources,'cache')).then(()=>true,()=>false),false,'rejected storage choices must not write into sources');
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

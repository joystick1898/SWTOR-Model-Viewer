import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {panelLayout} from '../src/renderer/panel-layout.mjs';
import {expressionLibrary} from '../src/expressions.mjs';
import {animationLibrary} from '../src/animation-library.mjs';
test('saved sidebars fit after window shrink without changing normal widths',()=>{
 assert.deepEqual(panelLayout(1450,{left:260,right:310}),{left:260,right:310});
 for(const requested of [{left:10000,right:220},{left:200,right:10000},{left:NaN,right:Infinity},{left:700,right:800}]){
  const r=panelLayout(1050,requested);assert(r.left>=200&&r.right>=220);assert(r.left+r.right<=718.00001);
 }
});
test('failed catalog loads can retry without restarting',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'swtor-cache-retry-'));
 try{
  for(const [i,read] of [expressionLibrary,animationLibrary].entries()){
   const directory='missing'+i;await assert.rejects(read(root,directory));await fs.mkdir(path.join(root,directory));
   const result=await read(root,directory);assert.deepEqual(Array.isArray(result)?result:result.clips,[]);
  }
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {designerOptions} from '../src/designer.mjs';
import {convert,defaultState} from '../src/backend.mjs';
import {writeExportBundle} from '../src/export-bundle.mjs';
const cases=['bma','bmn','bms','bmf','bfa','bfn','bfs','bfb'].map(body=>({species:'human',body}));cases.push({species:'twilek',body:'bfn'},{species:'nautolan',body:'bmn'});
const results=[];
for(const c of cases){try{
 const {designer}=await designerOptions(c);const state={...defaultState,version:2,character:'native-designer',designer,clip:null};
 const preview=await convert(state);assert(!preview.parts.some(p=>/mtx16|jacket/.test(p.source||'')));
 assert(['chest','leg','hand','boot'].every(slot=>preview.parts.some(p=>p.slot===slot)));
 const exported=await convert(state,'fbx');const destination=path.resolve('output/underwear-validation',c.species+'-'+c.body+'.fbx');await writeExportBundle(exported,state,destination);
 results.push({id:c.species+':'+c.body,ok:true,exported,destination});console.log('PASS',c);
}catch(e){results.push({id:c.species+':'+c.body,ok:false,error:e.stack});console.log('FAIL',e.message);}
await fs.writeFile('reports/underwear-pipeline-smoke.json',JSON.stringify({ok:results.every(r=>r.ok),results},null,2));}

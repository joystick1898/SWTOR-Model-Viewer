import fs from 'node:fs/promises';
import {config} from '../src/backend.mjs';
import {animationLibrary} from '../src/animation-library.mjs';
const profiles=JSON.parse(await fs.readFile('reports/animation-library-audit.json','utf8')),results=[];
for(const p of profiles){try{const l=await animationLibrary(config.resources,p.directory.replace(/\/$/,''));results.push({profile:p.body,directory:p.directory,total:l.clips.length,mapped:l.clips.length-l.unsupported.length,pending:l.unsupported.length});}catch(e){results.push({profile:p.body,error:e.message});}}
const directories=[...new Map(results.filter(r=>!r.error).map(r=>[r.directory,r])).values()];
const report={profiles:results.length,mappedProfiles:results.filter(r=>r.mapped>0).length,uniqueLibraries:directories.length,mappedClips:directories.reduce((s,r)=>s+r.mapped,0),pendingClips:directories.reduce((s,r)=>s+r.pending,0),note:'Structural association audit; not a visual validation of every clip. Counts exclude additive clips.',results};
await fs.writeFile('reports/browser-mapping-coverage.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,results:undefined}));

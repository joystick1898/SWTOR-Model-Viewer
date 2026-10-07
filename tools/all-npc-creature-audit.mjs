import fs from 'node:fs/promises';
import {config} from '../src/backend.mjs';
import {assetIndex} from '../src/asset-index.mjs';
import {assetMetadata} from '../src/asset-metadata.mjs';
const assets=(await assetIndex(config.resources)).filter(a=>['creature','npc','droid','pet'].includes(a.category)),results=[];
for(const a of assets){const m=await assetMetadata(config.resources,a);results.push({id:a.id,category:a.category,profile:m.profile,skeleton:m.skeleton,library:m.animationDirectory,materials:m.materials.length,total:m.clips.length,mapped:m.clips.length-m.unsupportedClips.length,pending:m.unsupportedClips});}
const report={total:results.length,associated:results.filter(r=>r.profile).length,animated:results.filter(r=>r.mapped>0).length,unassociated:results.filter(r=>!r.profile).map(r=>r.id),results};await fs.writeFile('reports/all-npc-creature-coverage.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,results:undefined,unassociated:report.unassociated.length}));

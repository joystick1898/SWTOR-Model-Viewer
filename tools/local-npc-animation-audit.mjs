import fs from 'node:fs/promises';
import {animationLibrary} from '../src/animation-library.mjs';
const folder='output/local-npcs/appearances',profiles=new Map();
const catalog=JSON.parse(await fs.readFile('output/local-npcs/catalog.json','utf8'));
const files=[...new Set(catalog.items.filter(r=>r.ready).map(r=>r.appearanceId+'.json'))];
for(const file of files){const r=JSON.parse(await fs.readFile(folder+'/'+file,'utf8'));if(r.profile)profiles.set(r.profile.id,r.profile);}
const results=[];
for(const p of profiles.values()){
 try{const lib=await animationLibrary('G:/Old Republic Assets/resources',p.animationDirectory);results.push({profile:p.id,clips:lib.clips.length,playable:lib.clips.length-lib.unsupported.length,ok:lib.clips.length>lib.unsupported.length});}
 catch(e){results.push({profile:p.id,ok:false,error:e.message});}
}
await fs.writeFile('reports/local-npc-animation-audit.json',JSON.stringify({profiles:results.length,results},null,2));console.log(results.filter(r=>!r.ok),results.length);

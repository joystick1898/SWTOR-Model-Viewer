import fs from 'node:fs/promises';
import {config} from '../src/backend.mjs';
import {animationLibrary} from '../src/animation-library.mjs';
import {readNativeJba} from './native-jba.mjs';
const profiles=JSON.parse(await fs.readFile('reports/browser-mapping-coverage.json','utf8')).results,results=[];let completed=0;
for(const directory of new Set(profiles.map(p=>p.directory.replace(/\/$/,'')))){
 const l=await animationLibrary(config.resources,directory),errors=[];let decoded=0,frames=0;
 for(const clip of l.clips){if(!l.mapping[clip])continue;try{const m=readNativeJba(await fs.readFile(config.resources+'/'+directory+'/'+clip));if(m.tracks!==l.mapping[clip].bones.length)throw Error('Map length mismatch');decoded++;frames+=m.frames;}catch(e){errors.push({clip,error:e.message});}}
 results.push({directory,mapped:Object.keys(l.mapping).length,decoded,frames,errors,pending:l.unsupported});completed+=decoded;
 await fs.writeFile('reports/all-animation-decode.json',JSON.stringify({complete:false,decoded:completed,libraries:results},null,2));console.log(directory,decoded,'errors',errors.length,'pending',l.unsupported.length);
}
await fs.writeFile('reports/all-animation-decode.json',JSON.stringify({complete:true,decoded:completed,libraries:results},null,2));

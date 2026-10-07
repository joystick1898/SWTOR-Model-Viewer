import fs from 'node:fs';
import {readNativeJba} from './native-jba.mjs';
import {readNativeRig,mapBmnTracks} from './native-rig.mjs';
const root = 'G:/Old Republic Assets/resources/anim/humanoid/bmnnew/';
const files = [...new Set(['cb_pistol_normal_to_combat.jba', ...fs.readdirSync(root).filter(n=>n.endsWith('.jba')).filter((_,i)=>i%700===0)])];
const results = files.map(file=>{
  try { const {motion,...summary}=readNativeJba(fs.readFileSync(root+file)); return {file,ok:true,...summary}; }
  catch(error) { return {file,ok:false,error:String(error)}; }
});
fs.writeFileSync('reports/native-jba-probe.json',JSON.stringify(results,null,2));
const native=readNativeJba(fs.readFileSync(root+'cb_pistol_normal_to_combat.jba'));
// Reference mapping is used ONLY for this diagnostic playback. Native MPH mapping
// has extra facial bones and has not yet been validated as a general lookup.
const rig=readNativeRig(fs.readFileSync(root+'anim_library.mph'));
native.sourceBind=mapBmnTracks(rig,native.tracks);
native.mappingSource='Native MPH bmnnew 102-track profile; general clip remapping not yet implemented';
native.names=native.sourceBind.map(b=>b.name==='GOD'?'Bip01':b.name);
const reference=JSON.parse(fs.readFileSync('reports/jba-pair.json')).legacyTrackNames.map(n=>n==='GOD'?'Bip01':n);
if(JSON.stringify(native.names)!==JSON.stringify(reference))throw Error('Native profile differs from reference labels');
fs.writeFileSync('output/atton-native-motion.json',JSON.stringify(native));
console.log(JSON.stringify(results.map(({file,ok,frames,tracks,error})=>({file,ok,frames,tracks,error})),null,2));

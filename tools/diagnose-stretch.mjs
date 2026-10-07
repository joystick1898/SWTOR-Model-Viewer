import fs from 'node:fs/promises';
import {decodeAssetMotion} from '../src/animation-library.mjs';
const root='G:/Old Republic Assets/resources',results=[];
for(const body of ['bfa','bfn','bmn'])for(const clip of ['cb_2saber_attack_right_1.jba','cb_2saber_attack_right_2.jba','cb_warrior_saber_idle_1.jba']){
 try{const m=await decodeAssetMotion(root,`anim/humanoid/${body}new`,clip);const deviations=m.names.map((name,i)=>({name,bind:m.sourceBind[i].translation,first:m.motion[i].translations[0],max:Math.max(...m.motion[i].translations.map(t=>Math.hypot(...t.map((v,j)=>v-m.sourceBind[i].translation[j]))))})).sort((a,b)=>b.max-a.max);results.push({body,clip,tracks:m.tracks,source:m.sourceProfile,rig:m.sourceRig,correction:m.mappingCorrection,deviations:deviations.slice(0,15)});console.log(body,clip,JSON.stringify(deviations.slice(0,5)));}catch(e){console.log(e.message)}
}await fs.writeFile('reports/stretch-diagnosis.json',JSON.stringify(results,null,2));

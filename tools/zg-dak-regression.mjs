// Private fixture supplied on the command line; no character/game data is checked in.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {exportZGCharacter} from '../src/backend.mjs';
import {resolveEquipment} from '../src/equipment.mjs';
import {assembleDesigner} from '../src/designer.mjs';
import {config} from '../src/runtime.mjs';
import {writeZGPackage} from '../src/zg-export.mjs';

const original=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const root=path.resolve('output/zg-dak-'+Date.now());await fs.mkdir(root,{recursive:true});
const equipment=await resolveEquipment(original.equipment,original.designer.body);
const helmet=equipment.find(e=>e.slot==='face');assert(helmet);
const base=await assembleDesigner(config.resources,config.fixture,original.designer,{animations:false});
const replaced=new Set(equipment.filter(e=>e.bone==='@skin'&&e.replaceSlot!==false).map(e=>e.slot));
const parts=[...base.slots.filter(s=>!replaced.has(s.slotName)).flatMap(s=>s.models.map(source=>({source,name:path.basename(source,'.gr2')}))),
 ...equipment.flatMap(e=>e.models.map(source=>({source,equipmentLayer:e.layer,name:'equipment_'+e.layer+'_'+path.basename(source,'.gr2')})))];
const helmetNames=parts.filter(p=>p.equipmentLayer===helmet.layer).map(p=>p.name);
const results=[];
for(const mode of ['helmet','head','wheel-red','fine-tuned']){
 const state=structuredClone(original);
 if(mode!=='helmet')state.hidden=helmetNames;
 if(mode==='fine-tuned'||mode==='wheel-red'){
  const chest=equipment.find(e=>e.slot==='chest');
  state.equipment[chest.layer].colors={'*':{primary:'#FF0000',...(mode==='fine-tuned'?{primaryPalette:{hue:.9,saturation:0,brightness:-.032,contrast:1.029}}:{})}};
 }
 const result=await exportZGCharacter({kind:'designer',state,parts});
 assert.equal(result.paths.some(s=>s.slotName==='face'),mode==='helmet');
 assert.equal(result.paths.some(s=>s.slotName==='head'),mode!=='helmet');
 if(mode==='fine-tuned'){
  const values=result.paths.find(s=>s.slotName==='chest').materialInfo.otherValues;
  for(const [i,v] of [.9,0,-.032,1.029].entries())assert(Math.abs(values.palette1[i]-v)<1e-6);
 }
 if(mode==='wheel-red')assert(Math.abs(result.paths.find(s=>s.slotName==='chest').materialInfo.otherValues.palette1[0]-.898064)<.00001);
 const saved=await writeZGPackage(result,path.join(root,mode));results.push({mode,...saved});
 console.log('DAK_PASS',mode);
}
const chest=equipment.find(e=>e.slot==='chest');await fs.writeFile(path.join(root,'chest-material.json'),JSON.stringify(chest.materialInfo,null,2));
await fs.writeFile('reports/zg-dak-regression.json',JSON.stringify({passed:true,root,results},null,2));
console.log(root);

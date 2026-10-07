import {designerOptions,importNpcDesigner,assembleDesigner} from '../src/designer.mjs';
import {convert,convertNpc,config,validateState} from '../src/backend.mjs';
import fs from 'node:fs/promises';
const imported=await importNpcDesigner('16141108995265840656-0');
console.log('import',imported.designer, Object.fromEntries(Object.entries(imported.groups).map(([s,v])=>[s,v.length])));
const state={version:2,character:'native-designer',designer:imported.designer,clip:'am_env_idle_hot_01.jba',time:0,hidden:[],rootMotion:false,weapon:'none',exportRig:true,equipment:[]};
const assembly=await assembleDesigner(config.resources,config.fixture,state.designer);console.log('slots',assembly.slots.map(s=>[s.slotName,s.models]));
console.log('preview',await convert(state,'preview',console.log));
await fs.writeFile('reports/designer-admiral-preset.json',JSON.stringify(state,null,2));

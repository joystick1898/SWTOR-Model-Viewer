import fs from 'node:fs/promises';
import {convert,defaultState,designerOptions,convertNpc} from '../src/backend.mjs';
const options=await designerOptions({species:'human',body:'bfn'});
const state={...defaultState,version:2,character:'native-designer',designer:options.designer,clip:'cb_2saber_attack_right_1.jba',expression:'ad_face_joy_pose_01.jba'};
const preview=await convert(state);
const exported=await convert(state,'fbx');
const npc=await convertNpc('16141165779735661825-0',{expression:'ad_face_anger_pose_01.jba'});
await fs.writeFile('reports/expression-smoke.json',JSON.stringify({results:[{id:'expression-human',exported:{state}}],preview,exported,npc},null,2));
console.log(JSON.stringify({preview:preview.file,exported:exported.file,npc:npc.file,options:preview.expressions.length,npcOptions:npc.expressions.length}));

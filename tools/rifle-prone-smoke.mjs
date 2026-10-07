import {convertNpc} from '../src/backend.mjs';
import fs from 'node:fs/promises';
const id='16140997066546414043-0',equipment=[{item:'2607262c6d3f559390a093ea',bone:'RightWeapon',position:[0,0,0],rotation:[0,0,0],scale:1}];
const r=await convertNpc(id,{clip:'am_rifle_prone_idle.jba',equipment});console.log(r.file);await fs.writeFile('reports/rifle-prone-fixture.json',JSON.stringify({id,equipment,result:r},null,2));

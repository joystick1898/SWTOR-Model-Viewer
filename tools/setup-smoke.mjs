import fs from 'node:fs/promises';
import path from 'node:path';
import {prepareData} from '../src/setup.mjs';
const project=process.cwd();
const local=JSON.parse(await fs.readFile('development.local.json','utf8'));
const home=path.join(project,'output/standalone-smoke-user');
const result=await prepareData({home,project,runtime:local,sources:local,allowMismatch:true,notify:message=>console.log(message)});
await fs.writeFile(path.join(project,'reports/standalone-setup.json'),JSON.stringify(result,null,2));
console.log('READY',result.data);

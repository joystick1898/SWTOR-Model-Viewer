import fs from 'node:fs/promises';import {convert} from '../src/backend.mjs';
const r=JSON.parse(await fs.readFile('reports/expression-smoke.json','utf8'));
r.neutral=await convert({...r.results[0].exported.state,expression:null});
await fs.writeFile('reports/expression-smoke.json',JSON.stringify(r,null,2));

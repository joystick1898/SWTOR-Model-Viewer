import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Local developer paths are never included in a release.
let local={};
if(process.env.SWTOR_PACKAGED!=='1')try{local=JSON.parse(fs.readFileSync(path.join(project,'development.local.json'),'utf8'));}catch{}
export const config={
  resources:process.env.SWTOR_RESOURCES||local.resources||'',
  game:process.env.SWTOR_GAME||local.game||'',
  blender:process.env.SWTOR_BLENDER||local.blender||'',
  addons:process.env.SWTOR_ADDONS||local.addons||'',
  python:process.env.SWTOR_PYTHON||local.python||'',
  fixture:process.env.SWTOR_FIXTURE||local.fixture||'',
};
export const dataRoot=process.env.SWTOR_DATA||path.join(project,'output');
export const dataPath=(...parts)=>path.join(dataRoot,...parts);
// Workers inherit the same source selection and writable snapshot directory.
for(const [key,value] of Object.entries(config))if(value)process.env['SWTOR_'+key.toUpperCase()]=value;
process.env.SWTOR_DATA=dataRoot;
process.env.PYTHONDONTWRITEBYTECODE='1';
process.env.PYTHONUTF8='1';

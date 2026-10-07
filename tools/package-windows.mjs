import fs from 'node:fs/promises';
import path from 'node:path';
import {packager} from '@electron/packager';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const project=process.cwd(),pkg=JSON.parse(await fs.readFile('package.json','utf8'));
const local=JSON.parse(await fs.readFile('development.local.json','utf8'));
const build=path.join(project,'dist','build-'+Date.now()),stage=path.join(build,'app');
await fs.mkdir(stage,{recursive:true});
const filter=file=>!file.split(path.sep).some(p=>['__pycache__','.git','test','tests'].includes(p))&&!/\.(pdb|pyc|lib)$/i.test(file);
for(const directory of ['src','worker','assets'])await fs.cp(path.join(project,directory),path.join(stage,directory),{recursive:true,filter});
const tools=['native-jba.mjs','native-rig.mjs','runtime_paths.py','local_tor.py','local_gom.py','build_local_npcs.py','build_equipment.py','build_designer.py','build_designer_labels.py','sample_designer_labels.py','build_asset_names.py','assemble_designer.py','check_sources.py','recover_sources.py'];
await fs.mkdir(path.join(stage,'tools'));
for(const file of tools)await fs.copyFile(path.join(project,'tools',file),path.join(stage,'tools',file));
await fs.mkdir(path.join(stage,'node_modules'));
await fs.cp(path.join(project,'node_modules/three'),path.join(stage,'node_modules/three'),{recursive:true});
await fs.writeFile(path.join(stage,'package.json'),JSON.stringify({name:pkg.name,version:pkg.version,description:pkg.description,main:pkg.main,dependencies:{three:pkg.dependencies.three}}));
const [app]=await packager({dir:stage,out:build,name:'SWTOR Model Viewer',executableName:'SWTOR Model Viewer',platform:'win32',arch:'x64',electronVersion:pkg.dependencies.electron,asar:false,prune:false,icon:path.join(project,'assets/viewer.ico'),win32metadata:{ProductName:'SWTOR Model Viewer',FileDescription:'SWTOR Model Viewer',CompanyName:'Joystick1898'},quiet:false});
const runtime=path.join(app,'resources/runtime');await fs.mkdir(runtime,{recursive:true});
console.log('Bundling tested Blender runtime…');
await fs.cp(path.dirname(local.blender),path.join(runtime,'blender'),{recursive:true,filter});
console.log('Bundling Python runtime…');
const python=path.dirname(local.python),pythonTarget=path.join(runtime,'python');await fs.mkdir(pythonTarget);
for(const entry of await fs.readdir(python,{withFileTypes:true})){
  if(entry.isDirectory()&&!['DLLs','Lib'].includes(entry.name))continue;
  if(entry.isFile()&&!/\.(exe|dll|txt)$/i.test(entry.name))continue;
  await fs.cp(path.join(python,entry.name),path.join(pythonTarget,entry.name),{recursive:true,filter:file=>filter(file)&&!file.split(path.sep).includes('site-packages')});
}
console.log('Bundling GR2 importer and its license/source…');
await fs.mkdir(path.join(runtime,'addons'));
await fs.cp(path.join(local.addons,'io_scene_gr2'),path.join(runtime,'addons/io_scene_gr2'),{recursive:true,filter});
console.log('Including release documents and source snapshot…');
for(const name of ['START-HERE.txt','THIRD-PARTY-NOTICES.txt','SOURCE-CODE.txt']){
  const text=await fs.readFile(path.join(project,'release',name),'utf8');
  await fs.writeFile(path.join(app,name),text.replaceAll('{{VERSION}}',pkg.version));
}
await fs.copyFile(path.join(project,'CONTRIBUTORS.md'),path.join(app,'CONTRIBUTORS.md'));
await fs.copyFile(path.join(project,'LICENSE'),path.join(app,'VIEWER-LICENSE.txt'));
await fs.cp(path.join(project,'release/licenses'),path.join(app,'licenses'),{recursive:true});
const sourceDirectory=path.join(build,'sources');
const prepared=await promisify(execFile)(local.python,[path.join(project,'tools/prepare-release-sources.py'),'--output',sourceDirectory,'--app',app],{maxBuffer:1024*1024});
console.log(prepared.stdout);
let bytes=0,files=0;const digest=createHash('sha256');
async function inventory(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())await inventory(file);else{const st=await fs.stat(file);bytes+=st.size;files++;digest.update(path.relative(app,file)+':'+st.size);}}}
await inventory(app);
const result={version:pkg.version,app,sourceDirectory,files,bytes,inventoryHash:digest.digest('hex'),builtAt:new Date().toISOString()};
await fs.writeFile(path.join(project,'dist/latest.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));

// Assemble only code and diagnostic summaries, never game assets or local config.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const target='contributions/zg-animation-fix';
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const write=async(p,v)=>fs.writeFile(path.join(target,p),JSON.stringify(v,null,2)+'\n');
const copied=[];
for(const file of ['tools/native-jba.mjs','tools/native-rig.mjs','src/animation-library.mjs','LICENSE']){
 const data=await fs.readFile(file);
 await fs.mkdir(path.dirname(path.join(target,file)),{recursive:true});
 await fs.writeFile(path.join(target,file),data);
 copied.push({source:file,destination:file,sha256:sha(data),verbatim:true});
}
let pair=await fs.readFile('tools/compare-jba-pair.mjs','utf8');
pair=pair.replace(/const legacyPath = .*;\r?\nconst nativePath = .*;/,
 "const [legacyPath,nativePath]=process.argv.slice(2);\nif(!legacyPath||!nativePath)throw Error('Usage: node compare-pair.mjs LEGACY_JBA NATIVE_JBA');");
pair=pair.replace("path: legacyPath", "file: legacyPath.replaceAll('\\\\','/').split('/').at(-1)")
 .replace("path: nativePath", "file: nativePath.replaceAll('\\\\','/').split('/').at(-1)");
pair=pair.replace(/fs.writeFileSync\('reports\/jba-pair.json'.*\r?\nconsole.log\(.*\);/,
 "console.log(JSON.stringify(report,null,2));");
pair=pair.replace(/,\r?\n  remaining: \[[^\]]*\]/, '');
await fs.writeFile(path.join(target,'compare-pair.mjs'),pair);
const p=await json('reports/jba-pair.json');
for(const side of ['legacy','native']){delete p[side].path;p[side].file='cb_pistol_normal_to_combat.jba';}
delete p.remaining;delete p.legacyTrackNames;
const a=await json('reports/native-atton-preview.json'),r=await json('reports/retarget-comparison.json'),d=await json('reports/all-animation-decode.json');
await write('evidence/historical-summary.json',{
 status:'Historical project reports, not rerun during packaging; source files listed below.',
 pair:{source:'reports/jba-pair.json',...p},
 decoderComparison:{source:'reports/native-atton-preview.json',scope:a.scope,
  maxTranslationError:a.max_translation_error_vs_legacy,maxQuaternionError:a.max_quaternion_error_vs_legacy},
 retarget:{source:'reports/retarget-comparison.json',method:r.method,bindIdentityMaxError:r.bind_identity_max_error,
  originalMapping:r.native_mapping,originalRootMode:r.root_mode},
 corpus:{source:'reports/all-animation-decode.json',complete:d.complete,decoded:d.decoded,
  limitation:'Historical decoding result, not per-clip visual proof or an upstream compatibility guarantee.'}
});
const files=[];
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);
 if(entry.isDirectory()){if(entry.name!=='__pycache__')await walk(file);}
 else if(entry.name!=='SOURCE-MANIFEST.json')files.push({file:path.relative(target,file).replaceAll('\\','/'),sha256:sha(await fs.readFile(file))});
}}
await walk(target);
await write('SOURCE-MANIFEST.json',{prepared:'2026-10-09',project:'https://github.com/joystick1898/SWTOR-Model-Viewer',
 baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 snapshot:'Development working tree; copied file hashes, not baseCommit alone, identify the source.',
 copied,adapted:[{file:'compare-pair.mjs',source:'tools/compare-jba-pair.mjs',changes:'CLI arguments, path sanitization, stdout JSON instead of repository report writes.'},
 {file:'blender_bind_relative.py',source:'worker/convert.py',changes:'Extracted transform application, documentation, reusable functions and input checks.'},
 {file:'src/resource-files.mjs',changes:'Local-files adapter replaces viewer resource-recovery layer.'}],
 files:files.sort((a,b)=>a.file.localeCompare(b.file))});
console.log(`Prepared ${files.length+1} handoff files at ${target}`);

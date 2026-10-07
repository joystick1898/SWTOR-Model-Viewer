import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';

const local=JSON.parse(await fs.readFile('development.local.json','utf8'));
async function run(command,args){
  await new Promise((resolve,reject)=>{
    const child=spawn(command,args,{stdio:'inherit',windowsHide:true});
    child.on('error',reject);
    child.on('exit',code=>code===0?resolve():reject(new Error(`${command} exited with ${code}`)));
  });
}
await run(process.execPath,['tools/package-windows.mjs']);
await run(local.python,['tools/archive-release.py']);

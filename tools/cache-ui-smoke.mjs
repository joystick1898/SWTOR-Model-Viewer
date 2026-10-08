import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),project=process.cwd();
const home=await fs.mkdtemp(path.join(os.tmpdir(),'swtor-storage-ui-'));
const child=spawn(require('electron'),['.','--remote-debugging-port=9476'],{cwd:project,env:{...process.env,SWTOR_USER_HOME:home},windowsHide:true,stdio:['ignore','pipe','pipe']});
let log='',socket,sequence=0;const pending=new Map();
child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function call(method,params={}){const id=++sequence;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
try{
  let target;
  for(let attempt=0;attempt<60;attempt++){try{target=(await (await fetch('http://127.0.0.1:9476/json')).json()).find(t=>t.type==='page');if(target)break;}catch{}await delay(250);}
  assert.ok(target,'Viewer did not launch: '+log);
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
  socket.addEventListener('message',event=>{const result=JSON.parse(event.data),request=pending.get(result.id);if(request){pending.delete(result.id);result.error?request.reject(Error(result.error.message)):request.resolve(result.result);}});
  for(let i=0;i<40;i++){if(await evaluate('document.getElementById("storageHome")?.value.length>0'))break;await delay(250);}
  const initial=await evaluate(`({limit:document.getElementById('cacheLimit').value,age:document.getElementById('cacheAge').value,location:document.getElementById('storageHome').value,usage:document.getElementById('storageUsage').textContent,overflow:document.documentElement.scrollWidth>innerWidth})`);
  assert.equal(initial.limit,'2');assert.equal(initial.age,'14');assert.equal(initial.location,home);assert.equal(initial.overflow,false);
  assert.match(initial.usage,/0.00 GiB/);
  assert.equal(await evaluate(`(()=>{const input=document.getElementById('cacheLimit');input.value='-1';return input.checkValidity()})()`),false);
  assert.equal(await evaluate(`(()=>{const input=document.getElementById('cacheLimit');input.value='0';return input.checkValidity()})()`),true);
  const data=path.join(home,'snapshots','1111111111111111-11111111'),preview=path.join(data,'app-cache','fixture');
  await fs.mkdir(preview,{recursive:true});await fs.writeFile(path.join(preview,'preview.glb'),'temporary');await fs.writeFile(path.join(data,'catalog.json'),'keep');
  await fs.writeFile(path.join(home,'settings.json'),JSON.stringify({version:1,data}));
  await evaluate(`document.getElementById('clearCache').click()`);
  for(let i=0;i<40;i++){if(await evaluate(`document.getElementById('progress').textContent.includes('cache cleared')`))break;await delay(100);}
  assert.equal(await fs.access(preview).then(()=>true,()=>false),false);assert.equal(await fs.readFile(path.join(data,'catalog.json'),'utf8'),'keep');
  assert.match(await evaluate(`document.getElementById('storageUsage').textContent`),/Preview cache: 0.00 GiB/);
  await fs.mkdir(path.join(project,'output'),{recursive:true});
  await evaluate(`document.querySelector('fieldset').scrollIntoView({block:'center'})`);
  await fs.writeFile(path.join(project,'output/cache-settings.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  console.log('PASS: actual Electron setup UI, defaults, validation, storage IPC and safe clear');
}finally{
  if(socket?.readyState===WebSocket.OPEN){await evaluate('window.close()').catch(()=>{});socket.close();}
  for(let i=0;i<40&&child.exitCode===null;i++)await delay(100);
  if(child.exitCode===null)child.kill();
  await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);});
  await fs.rm(home,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}

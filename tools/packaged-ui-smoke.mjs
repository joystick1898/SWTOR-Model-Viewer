import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
const project=process.cwd(),build=JSON.parse(await fs.readFile('dist/latest.json','utf8'));
const local=JSON.parse(await fs.readFile('development.local.json','utf8'));
const home=path.join(project,'output/packaged-smoke-home');
await fs.mkdir(path.join(project,'reports'),{recursive:true});
await fs.mkdir(path.join(project,'output'),{recursive:true});
// Preserve earlier test data while making first-launch verification repeatable.
try{await fs.rename(home,home+'-previous-'+Date.now());}catch(error){if(error.code!=='ENOENT')throw error;}
const env={...process.env,PATH:path.join(process.env.SystemRoot,'System32'),SWTOR_USER_HOME:home,PYTHONPATH:'',PYTHONHOME:''};
for(const key of Object.keys(env))if(key.startsWith('SWTOR_')&&key!=='SWTOR_USER_HOME')delete env[key];
const child=spawn(path.join(build.app,'SWTOR Model Viewer.exe'),['--remote-debugging-port=9464'],{cwd:build.app,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let socket,sequence=0;const pending=new Map();
async function call(method,params={}){const id=++sequence;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
try{
  let target;
  for(let i=0;i<60;i++){try{target=(await (await fetch('http://127.0.0.1:9464/json')).json()).find(t=>t.type==='page');if(target)break;}catch{}await delay(500);}
  if(!target)throw Error('Packaged window did not launch: '+log);
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
  socket.addEventListener('message',e=>{const r=JSON.parse(e.data);if(pending.has(r.id)){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(r.error.message)):p.resolve(r.result);}});
  await delay(1500);
  const first=await evaluate('({url:location.href,text:document.body.innerText})');
  if(!first.url.includes('setup.html'))throw Error('Fresh package did not open setup');
  if(!first.text.includes('Generated with AI'))throw Error('Setup AI disclosure is missing');
  await fs.writeFile('output/standalone-setup.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  if(await evaluate('!document.getElementById("start").disabled'))await evaluate(`document.getElementById('resources').value=${JSON.stringify(local.resources)};document.getElementById('game').value=${JSON.stringify(local.game)};document.getElementById('setupForm').requestSubmit();`);
  let ready=false,last='';
  for(let i=0;i<180;i++){
    await delay(5000);
    const state=await evaluate('({url:location.href,status:document.getElementById("status")?.textContent,progress:document.getElementById("progress")?.textContent,enabled:!document.getElementById("start")?.disabled})');
    const message=state.status||state.progress;if(message!==last){console.log(message);last=message;}
    if(state.url.includes('index.html')&&state.status?.startsWith('Ready')){ready=true;break;}
    if(state.url.includes('index.html')&&await evaluate('!!document.querySelector("#nativeSpecies option") && !document.getElementById("export").disabled')){ready=true;break;}
    if(state.url.includes('setup.html')&&state.enabled)throw Error(state.progress);
  }
  if(!ready)throw Error('Packaged viewer did not finish loading');
  await delay(1000);
  await fs.writeFile('output/standalone-viewer.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  const report=await evaluate('(async()=>({info:await viewer.setupInfo(),npcs:await viewer.npcs({query:"Malgus",offset:0}),assets:await viewer.assets({query:"Senya",offset:0}),status:document.getElementById("status").textContent}))()');
  if(!report.info.packaged||!report.npcs.total||!report.assets.total)throw Error('Packaged catalog checks failed');
  const zgControls=await evaluate(`(async()=>{
    const {colorMenu}=await import('./color-menu.js');
    const {paletteChannel}=await import('./palette-channel.js');
    const colors={};
    const menu=colorMenu('Release test',[paletteChannel(()=>colors,'*','primary','primary',undefined,null,()=>({hue:.898,saturation:.5,brightness:-.032,contrast:1.029}))]);
    document.body.append(menu);
    const brightness=menu.querySelector('[aria-label$="primary native brightness"]');
    menu.querySelector('[aria-label="Increase primary brightness by 0.1"]').click();
    const autoStep=brightness.value==='0.068';
    brightness.value='-.032';brightness.dispatchEvent(new Event('change'));
    brightness.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
    const typedPrecision=brightness.value==='-0.132';menu.remove();
    return {exportEnabled:!document.getElementById('exportZG').disabled,ipcAvailable:typeof viewer.exportZG==='function',autoStep,typedPrecision};
  })()`);
  if(!Object.values(zgControls).every(Boolean))throw Error('Packaged ZG/color controls failed: '+JSON.stringify(zgControls));
  const summarize=value=>({total:value.total,indexed:value.indexed,samples:value.items.slice(0,3).map(({id,name})=>({id,name}))});
  await fs.writeFile('reports/standalone-packaged-ui.json',JSON.stringify({ok:true,zgControls,info:report.info,status:report.status,npcs:summarize(report.npcs),assets:summarize(report.assets)},null,2));console.log('PACKAGED UI PASS');
}finally{
  socket?.close();
  if(child.exitCode===null)spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await fs.writeFile('output/packaged-ui.log',log);
}

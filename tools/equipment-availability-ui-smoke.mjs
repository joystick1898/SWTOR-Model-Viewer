import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {designerOptions} from '../src/designer.mjs';
import {equipmentSearch} from '../src/equipment.mjs';
const require=createRequire(import.meta.url);
let playwright;
try{playwright=require(process.env.SWTOR_PLAYWRIGHT||'playwright');}
catch(error){if(process.env.SWTOR_PLAYWRIGHT)throw error;playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const {chromium}=playwright;
const root=process.cwd();
const fixture=`import {organizeWorkspace} from '/src/renderer/workspace.js';
import {resizablePanels} from '/src/renderer/panels.js';
import {nativeDesigner} from '/src/renderer/designer.js';
import {equipmentUI} from '/src/renderer/equipment.js';
organizeWorkspace();resizablePanels();
window.optionDelay=0;window.catalogCalls=0;
const api={designerOptions:async draft=>{if(window.optionDelay)await new Promise(resolve=>setTimeout(resolve,window.optionDelay));const r=await fetch('/api/options',{method:'POST',body:JSON.stringify(draft)});if(!r.ok)throw Error(await r.text());return r.json();},equipment:async draft=>{window.catalogCalls++;return (await fetch('/api/equipment',{method:'POST',body:JSON.stringify(draft)})).json();}};
const first=await api.designerOptions({species:'human',body:'bmn'});
window.state={version:2,character:'native-designer',designer:first.designer,appearance:{body:'bmn'},time:.37,clip:'am_env_idle_hot_02.jba',expression:'neutral',hidden:[],equipment:[]};
window.context={identity:'designer:human:bmn',bones:['RightWeapon','LeftWeapon','Spine2','socket_saber_left'],parts:[],components:{},labels:{},equipment:[]};
window.applied=[];window.failApply=false;
window.designer=nativeDesigner(api,{getState:()=>state,status:message=>document.getElementById('status').textContent=message,apply:async next=>{if(failApply)return false;state=next;applied.push(structuredClone(next));await designer.sync(state);return true;}});
window.equipment=equipmentUI(api,()=>context,async next=>{if(failApply)return false;context.equipment=structuredClone(next);state.equipment=structuredClone(next);equipment();return true;});
await designer.sync(state);equipment();document.getElementById('clipTitle').textContent='Rest pose';document.getElementById('status').textContent='Ready · workspace UI checks';window.ready=true;`;
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png'};
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){let body='';for await(const chunk of req)body+=chunk;const value=JSON.parse(body);const result=url.pathname==='/api/options'?await designerOptions(value):await equipmentSearch(value);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));return;}
 if(url.pathname==='/fixture.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(fixture);return;}
 let file=path.resolve(root,'.'+(url.pathname==='/'?'/src/renderer/index.html':url.pathname));if(!file.startsWith(root+path.sep))throw Error('Outside project');
 let data=await fs.readFile(file);if(file.endsWith('index.html'))data=data.toString().replace(/<meta http-equiv="Content-Security-Policy"[^>]+>/,'').replace('<head>','<head><base href="/src/renderer/">').replace('src="app.js"','src="/fixture.js"');
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);
 }catch(error){res.writeHead(500);res.end(error.message);}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:'msedge'});
const page=await browser.newPage({viewport:{width:1450,height:950},colorScheme:'dark'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>window.ready,{timeout:60000});
 await page.setViewportSize({width:1450,height:950});
 for(const [query,body,disabled,label] of [["Republic Dancer's Top",'bmn',true,'Unavailable for this body'],["Republic Dancer's Top",'bfn',false,''],['Reforged Havoc Squad Helmet','bmn',false,'Missing attachments']]){
  await page.evaluate(({query,body})=>{context.body=body;document.getElementById('equipmentOpen').onclick();document.getElementById('equipmentSearch').value=query;document.getElementById('equipmentSearch').dispatchEvent(new Event('input'));},{query,body});
  console.log('Checking',query,body,disabled,label);
  const item=page.locator('#equipmentResults button').filter({hasText:query}).first();await item.waitFor({timeout:30000});
  await page.waitForFunction(({query,label,disabled})=>{const b=[...document.querySelectorAll('#equipmentResults button')].find(b=>b.textContent.includes(query));return b&&b.disabled===disabled&&(!label||b.textContent.includes(label));},{query,label,disabled},{timeout:30000});
  assert.equal(await item.isDisabled(),disabled);if(label)assert((await item.textContent()).includes(label));
  await page.evaluate(()=>{equipment.setBusy(true);equipment.setBusy(false);});assert.equal(await item.isDisabled(),disabled,'Busy toggle preserves availability');
 }
 await page.evaluate(()=>document.getElementById('equipmentClose').onclick());
 assert.deepEqual(errors,[]);console.log('EQUIPMENT AVAILABILITY UI PASS');
}catch(error){console.log(await page.locator('#equipmentResults').innerText(),await page.locator('#equipmentCount').innerText());throw error;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

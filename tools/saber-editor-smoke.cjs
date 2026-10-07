const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');const path=require('node:path');
app.whenReady().then(async()=>{try{
 const folder=path.resolve('output/saber-layout-review');await fs.mkdir(folder,{recursive:true});
 const html=`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="../../src/renderer/style.css"><link rel="stylesheet" href="../../src/renderer/workbench.css"><style>body{display:block;margin:0;padding:16px;background:#1b1e24;color:#ddd;font:14px system-ui;overflow:auto}#equipmentLayers{max-height:none}.equipmentLayer{margin:0}button,input,select{font:inherit}details{padding:8px 0}summary{cursor:pointer}input[type=color]{height:30px}.colorControl{display:grid;grid-template-columns:45px minmax(0,1fr);gap:8px}</style></head><body><div id="equipmentLayers"><div class="equipmentLayer"><strong>Lightsaber · equipment layer</strong><div id="editor"></div></div></div><script type="module">import {saberEditor} from '../../src/renderer/saber-editor.js';window.layer={};document.querySelector('#editor').append(saberEditor(window.layer,false));window.nativeLayer={blade:{enabled:true,effect:'native',length:90,width:2}};window.nativeEditor=saberEditor(window.nativeLayer,false);window.ready=true;</script></body></html>`;
 await fs.writeFile(path.join(folder,'editor.html'),html);
 const win=new BrowserWindow({width:440,height:900,show:false,webPreferences:{contextIsolation:true,offscreen:true}});await win.loadFile(path.join(folder,'editor.html'));
 const result=await win.webContents.executeJavaScript(`(async()=>{
  if(!window.ready)await new Promise(r=>setTimeout(r,200));
  const check=(ok,message)=>{if(!ok)throw Error(message)};
  const nativeMotion=window.nativeEditor.querySelector('[aria-label="Blade motion"]');nativeMotion.value='animated';nativeMotion.dispatchEvent(new Event('change'));check(window.nativeLayer.blade.motion==='animated'&&!window.nativeLayer.blade.layout,'Motion must preserve native vent layout');
  const root=document.querySelector('.saberEditor');check(!root.open,'Editor should start compact');root.open=true;
  const toggles=[...root.querySelectorAll('.saberToggles input')];check(toggles.length===4,'Four toggles');
  for(const toggle of toggles){toggle.checked=true;toggle.dispatchEvent(new Event('change'));}check(Object.values(layer.blade.layout).every(Boolean),'All on');
  for(const toggle of toggles){toggle.checked=false;toggle.dispatchEvent(new Event('change'));}check(!layer.blade.enabled,'All off');
  for(const toggle of toggles){toggle.checked=true;toggle.dispatchEvent(new Event('change'));}
  const effect=root.querySelector('[aria-label="Blade effect"]');effect.value='vintage';effect.dispatchEvent(new Event('change'));const motion=root.querySelector('[aria-label="Blade motion"]');motion.value='animated';motion.dispatchEvent(new Event('change'));const frame=root.querySelector('[aria-label="Blade texture frame"]');frame.value='31';frame.dispatchEvent(new Event('input'));check(layer.blade.effect==='vintage'&&layer.blade.motion==='animated'&&layer.blade.frame===31,'Persistent controls survive edits');
  const choose=root.querySelector('[aria-label="Saber element"]');check(choose.options.length===4,'Four component editors');choose.parentElement.open=true;
  const edit=(label,value,event='input')=>{const input=root.querySelector('[aria-label="'+label+'"]');input.value=value;input.dispatchEvent(new Event(event));};
  choose.value='diagonal';choose.dispatchEvent(new Event('change'));
  edit('Element Position X cm','2.5');edit('Element Rotation Z degrees','-15');edit('Element Brightness','3');edit('Element glow hex','#ff4400','change');
  choose.value='dual';choose.dispatchEvent(new Event('change'));edit('Element glow hex','#00ff88','change');edit('Element Length (cm)','65');
  check(layer.blade.elements.diagonalRight.position[0]===2.5,'Independent position');check(layer.blade.elements.diagonalRight.rotation[2]===-15,'Independent rotation');check(layer.blade.elements.diagonalRight.glow==='#ff4400','Independent color');check(layer.blade.elements.single.glow==='#4080ff','Main untouched');check(layer.blade.elements.diagonalRight.intensity===3&&layer.blade.elements.single.intensity===1.5,'Independent brightness');
  choose.value='diagonal';choose.dispatchEvent(new Event('change'));check(root.querySelector('[aria-label="Element Position X cm"]').value==='2.5','Editor restores values');
  const placement=[...root.querySelectorAll('summary')].find(s=>s.textContent==='Position & direction').parentElement;placement.open=true;
  check(document.documentElement.scrollWidth<=innerWidth,'No horizontal overflow');
  check(JSON.stringify(layer.blade.elements.diagonalLeft)===JSON.stringify(layer.blade.elements.diagonalRight),'Linked guard pair');return structuredClone(layer.blade);
 })()`);
 await fs.writeFile(path.join(folder,'ui-state.json'),JSON.stringify(result,null,2));await new Promise(r=>setTimeout(r,300));await fs.writeFile(path.join(folder,'editor.png'),(await win.webContents.capturePage()).toPNG());
 console.log('SABER_EDITOR_PASS');win.destroy();app.exit(0);
}catch(e){console.error(e);app.exit(1);}});

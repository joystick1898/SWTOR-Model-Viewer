// Exercise the real renderer -> preload -> IPC -> export path with test dialogs.
const {app,ipcMain,dialog}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
process.argv.push('--smoke');
const destination=path.resolve('output/zg-ui-'+Date.now());
const setPath=app.setPath.bind(app);
app.setPath=(name,value)=>setPath(name,name==='userData'?path.join(destination,'user-data'):value);
let saved,preview;
const original=ipcMain.handle.bind(ipcMain);
ipcMain.handle=(name,callback)=>original(name,async(...args)=>{
  const result=await callback(...args);
  if(name==='catalog')return {...result,smoke:false};
  if(name==='export-zg')saved=result;
  if(name==='preview')preview=result;
  return result;
});
dialog.showOpenDialog=async(_,options)=>{await fs.mkdir(destination,{recursive:true});return {canceled:false,filePaths:[options?.title==='Open character pose'&&process.env.SWTOR_UI_PRESET?process.env.SWTOR_UI_PRESET:destination]};};
dialog.showMessageBox=async()=>({response:0});
app.on('browser-window-created',(_,win)=>{
  win.hide();
  win.webContents.on('did-finish-load',async()=>{
    if(!win.webContents.getURL().endsWith('index.html'))return;
    try{
      for(let i=0;i<240;i++){
        if(await win.webContents.executeJavaScript("!!document.querySelector('#exportZG')?.onclick && !document.querySelector('#exportZG').disabled && document.querySelector('#status').textContent.includes('Ready')"))break;
        await new Promise(r=>setTimeout(r,500));
      }
      const ready=await win.webContents.executeJavaScript("({enabled:!document.getElementById('exportZG').disabled,status:document.getElementById('status').textContent})");
      assert(ready.enabled,JSON.stringify(ready));
      let expectedHead=true;
      if(process.env.SWTOR_UI_PRESET){
        await win.webContents.executeJavaScript("document.getElementById('open').onclick()");
        const preset=JSON.parse(await fs.readFile(process.env.SWTOR_UI_PRESET,'utf8'));
        expectedHead=preview.parts.some(p=>p.slot==='head'&&!preset.hidden.includes(p.name));
        assert(preview?.parts.some(p=>p.nativePalettes?.length),'Applied preview does not expose native palette values');
        const menus=await win.webContents.executeJavaScript("[...document.querySelectorAll('#equipmentSlots .customColorMenu')].map(m=>({title:m.querySelector('summary').getAttribute('aria-label'),pieces:[...m.querySelectorAll('select option')].map(o=>o.textContent)}))");
        assert(menus.every(m=>m.pieces.every(p=>!p.includes('Whole item')&&!p.includes('Whole layer'))));
        const chest=preset.equipment.find(e=>e.components?.some(p=>p.includes('/chest/')));
        if(chest)assert.equal(menus.find(m=>m.title==='Chest colors').pieces.length,chest.components.length,'Excluded components still appear in dye menu');
      }
      const fine=await win.webContents.executeJavaScript(`(async()=>{
        const {colorMenu}=await import('./color-menu.js');
        const {paletteChannel}=await import('./palette-channel.js');
        const colors={};const channels=['primary','secondary'].map(c=>paletteChannel(()=>colors,'*',c,c,undefined,null,()=>({hue:.898,saturation:.5,brightness:-.032,contrast:1.029})));
        const menu=colorMenu('Chest colors',channels);const host=document.createElement('div');host.id='nativeColorTest';host.className='pieceColorRow';host.append(menu);document.querySelector('.inspector').prepend(host);menu.open=true;
        const picker=menu.querySelector('input[type=color]');picker.value='#ff0000';picker.dispatchEvent(new Event('input'));
        const hue=menu.querySelector('[aria-label$="primary native hue"]');hue.value='.9';hue.dispatchEvent(new Event('change'));
        const saturation=menu.querySelector('[aria-label$="primary native saturation"]');saturation.value='0';saturation.dispatchEvent(new Event('change'));
        const saved=structuredClone(colors);menu.refresh();const retained=hue.value==='0.9'&&saturation.value==='0';
        const brightness=menu.querySelector('[aria-label$="primary native brightness"]');
        const contrast=menu.querySelector('[aria-label$="primary native contrast"]');
        menu.querySelector('[aria-label="Increase primary brightness by 0.1"]').click();
        menu.querySelector('[aria-label="Increase primary contrast by 0.1"]').click();
        const autoStep=brightness.value==='0.068'&&contrast.value==='1.129';
        hue.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));const upperBound=hue.value==='1';
        brightness.value='-.032';brightness.dispatchEvent(new Event('change'));brightness.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
        const precisionStep=brightness.value==='-0.132';
        picker.value='#00ff00';picker.dispatchEvent(new Event('input'));const reset=hue.value===''&&saturation.value==='';
        picker.value='#ff0000';picker.dispatchEvent(new Event('input'));hue.value='.9';hue.dispatchEvent(new Event('change'));menu.querySelector('.paletteFine').open=true;
        return {saved,retained,reset,autoStep,upperBound,precisionStep};
      })()`);
      assert.deepEqual(fine.saved,{'*':{primary:'#FF0000',primaryPalette:{hue:.9,saturation:0}}});
      assert(fine.retained&&fine.reset,'Native controls did not retain/reset correctly');
      assert(fine.autoStep&&fine.upperBound&&fine.precisionStep,'Palette arrows lost the applied value, precision, or limits');
      await new Promise(r=>setTimeout(r,250));
      assert(await win.webContents.executeJavaScript("(()=>{const p=document.querySelector('#nativeColorTest .colorMenuContent').getBoundingClientRect();return p.width>150&&p.right<=innerWidth&&p.bottom<=innerHeight;})()"),'Native palette controls overflow the window');
      await fs.writeFile('output/native-color-controls-ui.png',(await win.webContents.capturePage()).toPNG());
      await win.webContents.executeJavaScript("document.getElementById('nativeColorTest').remove()");
      await win.webContents.executeJavaScript("document.getElementById('exportZG').onclick()");
      assert(saved?.file,await win.webContents.executeJavaScript("document.getElementById('status').textContent"));
      const paths=JSON.parse(await fs.readFile(saved.file,'utf8'));
      assert.equal(paths.some(s=>s.slotName==='head'),expectedHead);
      win.setSize(1050,800);
      await new Promise(r=>setTimeout(r,350));
      const fits=await win.webContents.executeJavaScript("(()=>{const header=document.querySelector('header').getBoundingClientRect();return ['exportZG','export'].every(id=>{const b=document.getElementById(id).getBoundingClientRect();return b.right<=innerWidth&&b.bottom<=header.bottom&&b.width>0;});})()");
      assert(fits,'Export controls do not fit at minimum window width');
      await fs.writeFile('output/zg-export-ui.png',(await win.webContents.capturePage()).toPNG());
      await win.webContents.executeJavaScript("document.getElementById('browserTab').onclick()");
      assert(await win.webContents.executeJavaScript("document.getElementById('exportZG').disabled"));
      if(process.env.SWTOR_UI_PRESET){
        await win.webContents.executeJavaScript("document.getElementById('designerTab').onclick()");
        assert(await win.webContents.executeJavaScript("!document.getElementById('exportZG').disabled && document.getElementById('status').textContent.includes('Ready')"),'Returning to equipped character failed');
      }
      await fs.writeFile('reports/zg-ui-smoke.json',JSON.stringify({passed:true,...saved,assetBrowserDisabled:true,presetUi:!!process.env.SWTOR_UI_PRESET,arrowsFromPreview:true,workspaceRoundTrip:!!process.env.SWTOR_UI_PRESET},null,2));
      console.log('ZG_UI_PASS');app.exit(0);
    }catch(e){console.error(e);app.exit(1);}
  });
});
require('../src/main.cjs');

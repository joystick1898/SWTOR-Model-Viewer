const {app,BrowserWindow,ipcMain,protocol,net,dialog}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const {pathToFileURL}=require('node:url');
const {createHash}=require('node:crypto');
const project=path.resolve(__dirname,'..');
if(process.argv.includes('--smoke'))app.setPath('userData',path.join(project,'output/app-smoke-user-data'));
else app.setPath('userData',process.env.SWTOR_USER_HOME||path.join(app.getPath('appData'),'SWTOR Model Viewer'));
protocol.registerSchemesAsPrivileged([{scheme:'viewer',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
let window,backend;
// One process owns this user's generated data, including cleanup and workers.
if(!app.requestSingleInstanceLock()){app.quit();}else{
app.whenReady().then(async()=>{
  const smoke=process.argv.includes('--smoke');
  if(app.isPackaged)process.env.SWTOR_PACKAGED='1';
  const setup=await import('./setup.mjs');
  const cache=await import('./cache-policy.mjs');
  let currentSettings,operation=Promise.resolve(),quitting=false,preparing=false,setupAbort;
  const serialize=callback=>{const next=operation.then(callback);operation=next.catch(()=>{});return next;};
  async function maintain(clear=false){
    if(currentSettings?.data&&!smoke)try{await cache.cleanCache(currentSettings.data,currentSettings.cache,clear,Date.now(),false);}catch(error){
      console.error('Cache cleanup:',error);if(window&&!window.isDestroyed())window.webContents.send('progress','Cache cleanup could not finish: '+error.message);
    }
  }
  app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
  app.on('before-quit',event=>{
    if(quitting||smoke)return;
    event.preventDefault();setupAbort?.abort();
    serialize(async()=>{await maintain(currentSettings?.cache?.clearOnExit===true);quitting=true;app.quit();});
  });
  const home=app.getPath('userData');
  let runtime;
  if(app.isPackaged){
    const root=path.join(process.resourcesPath,'runtime');
    runtime={python:path.join(root,'python/python.exe'),blender:path.join(root,'blender/blender.exe'),addons:path.join(root,'addons')};
  }else{
    try{runtime=JSON.parse(await fs.readFile(path.join(project,'development.local.json'),'utf8'));}catch{runtime={};}
  }
  async function launch(settings){
    currentSettings=settings;
    await maintain(settings.cache?.clearOnExit===true);
    if(app.isPackaged)process.env.SWTOR_FIXTURE='';
    for(const [key,value] of Object.entries({...runtime,...settings}))if(['resources','game','python','blender','addons','data'].includes(key))process.env['SWTOR_'+key.toUpperCase()]=value;
    process.env.PYTHONDONTWRITEBYTECODE='1';
    process.env.PYTHONUTF8='1';
    backend=await import('./backend.mjs');
    await window.loadURL('viewer://app/src/renderer/index.html');
    try{
      await cache.cleanSnapshots(path.dirname(settings.data),settings.data);
      if(settings.previousSnapshot&&path.dirname(settings.previousSnapshot)!==path.dirname(settings.data))await cache.removeSnapshot(settings.previousSnapshot);
    }catch(error){console.error('Snapshot cleanup:',error);}
  }
  protocol.handle('viewer',async request=>{
    const url=new URL(request.url);
    if(url.host!=='app')return new Response('Not found',{status:404});
    const relative=decodeURIComponent(url.pathname).replace(/^\//,'')||'src/renderer/index.html';
    const resolved=path.resolve(project,relative);
    const allowed=[path.join(project,'src/renderer')+path.sep,path.join(project,'node_modules/three')+path.sep];
    const sharedModule=resolved===path.join(project,'src/saber-layout.mjs');
    if(!sharedModule&&!allowed.some(prefix=>resolved.startsWith(prefix)))return new Response('Not found',{status:404});
    if(sharedModule)return new Response(await fs.readFile(resolved,'utf8'),{headers:{'content-type':'text/javascript'}});
    if(resolved.endsWith('index.html')){
      let html=await fs.readFile(resolved,'utf8');
      const map=html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1];
      html=html.replace('IMPORT_MAP_HASH',createHash('sha256').update(map).digest('base64'));
      return new Response(html,{headers:{'content-type':'text/html'}});
    }
    return net.fetch(pathToFileURL(resolved).href);
  });
  const conversions=new Set(['preview','npc-preview','asset-preview','export-fbx','export-npc-fbx','export-asset-fbx','export-zg']);
  function handle(name,callback){ipcMain.handle(name,(event,...args)=>{
    if(event.sender!==window.webContents||!event.senderFrame.url.startsWith('viewer://app/'))throw Error('Invalid sender');
    if(name==='setup-cancel')return callback(...args);
    return serialize(async()=>{try{return await callback(...args);}finally{if(conversions.has(name))await maintain();}});
  });}
  handle('setup-info',async()=>({settings:await setup.readSettings(home),version:app.getVersion(),packaged:app.isPackaged,dataHome:home,canReturn:!!backend}));
  handle('storage-info',async()=>{const settings=await setup.readSettings(home);return {...await cache.storageUsage(settings?.data),location:settings?.storageHome||home};});
  handle('storage-clear',async()=>{const settings=await setup.readSettings(home);return settings?.data?cache.cleanCache(settings.data,settings.cache,true):cache.storageUsage();});
  handle('setup-back',async()=>{if(backend&&!preparing)await window.loadURL('viewer://app/src/renderer/index.html');});
  handle('setup-folder',async()=>{const result=await dialog.showOpenDialog(window,{title:'Choose folder',properties:['openDirectory']});return result.canceled?null:result.filePaths[0];});
  handle('open-settings',async()=>{
    const choice=await dialog.showMessageBox(window,{type:'question',message:'Open settings?',detail:'Save any character changes first. Returning to the viewer reloads your workspace.',buttons:['Cancel','Open settings'],defaultId:0,cancelId:0});
    if(choice.response===1)await window.loadURL('viewer://app/src/renderer/setup.html?settings=1');
  });
  handle('setup-start',async(value={})=>{
    if(preparing)throw Error('Setup is already running.');
    preparing=true;
    setupAbort=new AbortController();
    try{
      const settings=await setup.prepareData({home,project,runtime,sources:value,storage:value.storage,rebuild:value.rebuild===true,signal:setupAbort.signal,notify:message=>{if(!window.isDestroyed())window.webContents.send('progress',message);}});
      if(backend){await maintain(currentSettings?.cache?.clearOnExit===true);app.relaunch();app.exit(0);return;}
      // Let the invoking page receive its result before navigating away.
      setTimeout(()=>serialize(()=>launch(settings)).catch(e=>dialog.showErrorBox('Viewer could not start',e.message)),100);
      return {ok:true,warning:settings.sourceCheck?.warning};
    }finally{preparing=false;setupAbort=null;}
  });
  handle('setup-cancel',()=>setupAbort?.abort());
  const smokeBody=process.argv.find(a=>a.startsWith('--body='))?.split('=')[1];
  const profileTest=process.argv.find(a=>a.startsWith('--profile-test='))?.split('=')[1];
  const assetTest=profileTest||process.argv.find(a=>a.startsWith('--asset-test='))?.split('=')[1];
  const smokeAsset=assetTest&&process.argv.includes('--smoke')?JSON.parse(await fs.readFile(path.join(project,profileTest?'reports/all-profile-export-smoke.json':'reports/browser-coverage-smoke.json'),'utf8')).results.find(r=>r.profile===assetTest):null;
  if(smokeBody&&!['bma','bmn','bms','bmf','bfa','bfn','bfs','bfb'].includes(smokeBody))throw Error('Invalid smoke profile');
  const nativeCase=process.argv.find(a=>a.startsWith('--native-case='))?.split('=')[1];
  const nativePreset=nativeCase&&process.argv.includes('--smoke')?JSON.parse(await fs.readFile(path.join(project,process.argv.includes('--pike-ux-test')?'reports/pike-ux-smoke.json':process.argv.includes('--blade-alignment-test')?'reports/blade-alignment-smoke.json':process.argv.includes('--expression-test')?'reports/expression-smoke.json':process.argv.includes('--stretch-test')?'reports/stretch-pipeline-smoke.json':process.argv.includes('--saber-test')?'reports/saber-pipeline-smoke.json':'reports/designer-pipeline-smoke.json'),'utf8')).results.find(r=>r.id===nativeCase)?.exported.state:null;
  handle('catalog',async body=>({...await backend.catalog(body),smoke:process.argv.includes('--smoke'),smokeNativePreset:nativePreset,smokeSaber:process.argv.includes('--saber-test'),smokePikeUx:process.argv.includes('--pike-ux-test'),smokeStretch:process.argv.includes('--stretch-test'),smokeExpression:process.argv.includes('--expression-test'),smokeEquipment:process.argv.includes('--equipment-test'),smokeEmitters:process.argv.includes('--emitter-test'),smokeGizmo:process.argv.includes('--gizmo-test'),smokeDesigner:process.argv.includes('--designer-test'),smokeNpc:process.argv.find(a=>a.startsWith('--npc-test='))?.split('=')[1],smokeDetail:process.argv.includes('--detail'),smokeBody,smokeAsset,smokeBrowser:!!smokeAsset||process.argv.includes('--browser-test')||process.argv.includes('--walker-test'),smokeCustom:process.argv.includes('--custom-test'),smokeWalker:!!smokeAsset||process.argv.includes('--walker-test'),smokeHair:process.argv.includes('--hair-test')}));
  handle('assets',query=>backend.assets(query));handle('asset-preview',(id,selection)=>backend.previewAsset(id,selection));
  handle('preview',async state=>{
    const result=await backend.convert(state,'preview',message=>window.webContents.send('progress',message));
    const bytes=await fs.readFile(result.file);return {...result,bytes:new Uint8Array(bytes)};
  });
  handle('equipment',query=>backend.equipment(query));
  handle('designer-options',value=>backend.designerOptions(value));
  handle('designer-import',id=>backend.importNpcDesigner(id));
  handle('npcs',query=>backend.npcs(query));
  handle('npc-preview',async(id,selection)=>{
    const result=await backend.convertNpc(id,selection,'preview',message=>window.webContents.send('progress',message));
    return {...result,bytes:new Uint8Array(await fs.readFile(result.file))};
  });
  handle('export-npc-fbx',async(id,selection)=>{
    if(typeof id!=='string'||!/^\d{16,20}-\d+$/.test(id))throw Error('Invalid NPC selection');
    const choice=await dialog.showSaveDialog(window,{title:'Export NPC pose',defaultPath:id+'-posed.fbx',filters:[{name:'FBX',extensions:['fbx']}]});
    if(choice.canceled)return null;
    const result=await backend.convertNpc(id,selection,'fbx',message=>window.webContents.send('progress',message));
    const {writeExportBundle}=await import('./export-bundle.mjs');
    await writeExportBundle(result,{npc:id,...selection,source:result.source},choice.filePath);return choice.filePath;
  });
  handle('save-preset',async state=>{
    state=backend.validateState(state);
    const choice=await dialog.showSaveDialog(window,{title:'Save character pose',defaultPath:'character-pose.json',filters:[{name:'Character preset',extensions:['json']}]});
    if(choice.canceled)return null;
    await fs.writeFile(choice.filePath,JSON.stringify(state,null,2));return choice.filePath;
  });
  handle('load-preset',async()=>{
    const choice=await dialog.showOpenDialog(window,{title:'Open character pose',properties:['openFile'],filters:[{name:'Character preset',extensions:['json']}]});
    if(choice.canceled)return null;
    return backend.validateState(JSON.parse(await fs.readFile(choice.filePaths[0],'utf8')));
  });
  handle('export-fbx',async state=>{
    state=backend.validateState(state);
    const choice=await dialog.showSaveDialog(window,{title:'Export textured posed FBX',defaultPath:'Character-posed.fbx',filters:[{name:'FBX',extensions:['fbx']}]});
    if(choice.canceled)return null;
    const result=await backend.convert(state,'fbx',message=>window.webContents.send('progress',message));
    const {writeExportBundle}=await import('./export-bundle.mjs');
    await writeExportBundle(result,state,choice.filePath);return choice.filePath;
  });
  handle('export-zg',async value=>{
    const choice=await dialog.showOpenDialog(window,{title:'Choose where to create the ZG character folder',properties:['openDirectory','createDirectory']});
    if(choice.canceled)return null;
    const result=await backend.exportZGCharacter(value,message=>window.webContents.send('progress',message));
    const {writeZGPackage,zgFolderName}=await import('./zg-export.mjs');
    const saved=await writeZGPackage(result,path.join(choice.filePaths[0],zgFolderName(result.name)));
    await dialog.showMessageBox(window,{type:'info',message:'ZG character export saved',detail:[saved.file,'',saved.bundledResources?'Set ZG Resources to the Resources folder inside this export.':'Use your extracted Resources folder in ZG Tools.','Open assets/paths.json with Character Assembler. Pose, weapons and saber effects are excluded.',...saved.warnings].join('\n'),buttons:['OK']});
    return saved;
  });
  handle('export-asset-fbx',async (id,selection)=>{
    const name=typeof id==='string'?path.basename(id,'.gr2'):'asset';
    const choice=await dialog.showSaveDialog(window,{title:'Export textured posed asset',defaultPath:name+'-posed.fbx',filters:[{name:'FBX',extensions:['fbx']}]});
    if(choice.canceled)return null;
    const result=await backend.convertAsset(id,selection,'fbx');
    const {writeExportBundle}=await import('./export-bundle.mjs');
    await writeExportBundle(result,{asset:id,...selection},choice.filePath);return choice.filePath;
  });
  handle('smoke-result',async result=>{
    if(!process.argv.includes('--smoke'))return;
    await fs.writeFile(path.join(project,'reports/app-ui-smoke.json'),JSON.stringify(result,null,2));
    const screenshot=nativeCase?'native-'+nativeCase.replace(':','-'):process.argv.includes('--designer-test')?'native-designer':process.argv.includes('--gizmo-test')?'equipment-gizmo':process.argv.includes('--equipment-test')?'equipment-layered':process.argv.some(a=>a.startsWith('--npc-test='))?'npc-'+process.argv.find(a=>a.startsWith('--npc-test=')).split('=')[1]:smokeAsset?'asset-'+assetTest:process.argv.includes('--walker-test')?'walker-animated':process.argv.includes('--hair-test')?'hair-anchored':process.argv.includes('--browser-test')?'asset-browser':process.argv.includes('--custom-test')?'designer-custom':smokeBody?'designer-'+smokeBody:process.argv.includes('--detail')?'grip-detail':'app-screenshot';
    await fs.writeFile(path.join(project,'reports/'+screenshot+'-smoke.json'),JSON.stringify(result,null,2));
    await fs.writeFile(path.join(project,'output/'+screenshot+'.png'),(await window.webContents.capturePage()).toPNG());
    if(process.argv.includes('--pike-ux-test')&&result.ok){
      await window.webContents.executeJavaScript("document.getElementById('nativeChoices').scrollIntoView({block:'start'})");
      await new Promise(resolve=>setTimeout(resolve,200));
      await fs.writeFile(path.join(project,'output/customization-labels.png'),(await window.webContents.capturePage()).toPNG());
      await window.webContents.executeJavaScript("document.getElementById('equipmentOpen').click()");
      await new Promise(resolve=>setTimeout(resolve,500));
      await fs.writeFile(path.join(project,'output/blade-spacing-controls.png'),(await window.webContents.capturePage()).toPNG());
    }
    if(process.argv.includes('--equipment-test')&&result.ok){
      await window.webContents.executeJavaScript("document.getElementById('equipmentOpen').click()");
      await new Promise(resolve=>setTimeout(resolve,400));
      await fs.writeFile(path.join(project,'output/equipment-selector.png'),(await window.webContents.capturePage()).toPNG());
    }
    app.exit(result.ok?0:1);
  });
  window=new BrowserWindow({width:1450,height:950,minWidth:1050,minHeight:700,title:'SWTOR Model Viewer',backgroundColor:'#10171d',webPreferences:{backgroundThrottling:!process.argv.includes('--smoke'),preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  if(process.argv.includes('--smoke')){
    window.webContents.on('console-message',(_event,...details)=>fs.appendFile(path.join(project,'output/ui-console.log'),JSON.stringify(details)+'\n'));
    setTimeout(async()=>{await fs.writeFile(path.join(project,'reports/ui-timeout.json'),JSON.stringify({text:await window.webContents.executeJavaScript('document.body.innerText')}));app.exit(1);},240000).unref();
  }
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_,__,callback)=>callback(false));
  window.setMenuBarVisibility(false);
  if(smoke){backend=await import('./backend.mjs');await window.loadURL('viewer://app/src/renderer/index.html');}
  else await window.loadURL('viewer://app/src/renderer/setup.html');
});
app.on('window-all-closed',()=>app.quit());
}

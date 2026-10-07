const api=window.viewer,$=id=>document.getElementById(id);
api.progress(message=>{$('progress').textContent=message;});
$('cancel').onclick=()=>{api.setupCancel();$('progress').textContent='Cancelling preparation…';};
$('back').onclick=()=>api.setupBack();
for(const name of ['resources','game'])$(name+'Browse').onclick=async()=>{const folder=await api.setupFolder();if(folder)$(name).value=folder;};
async function start(){
  const value={resources:$('resources').value.trim(),game:$('game').value.trim(),rebuild:$('rebuild').checked};
  for(const el of $('setupForm').elements)el.disabled=true;
  $('cancel').hidden=false;
  $('progress').textContent='Checking source folders…';
  try{await api.setupStart(value);$('progress').textContent='Opening viewer…';}
  catch(e){$('progress').textContent=e.message.replace(/^Error invoking remote method '[^']+': Error: /,'');for(const el of $('setupForm').elements)el.disabled=false;}
  finally{$('cancel').hidden=true;}
}
$('setupForm').onsubmit=event=>{event.preventDefault();start();};
try{
  const info=await api.setupInfo();$('version').textContent=`Version ${info.version} · ${info.packaged?'Standalone build':'Development build'}`;$('dataHome').textContent=info.dataHome;
  $('back').hidden=!info.canReturn;
  if(info.settings){
    for(const name of ['resources','game'])$(name).value=info.settings[name];
    $('warning').textContent=info.settings.sourceCheck?.warning||'';
    if(!new URLSearchParams(location.search).has('settings'))await start();
    else $('intro').textContent='Change your data folders or rebuild the catalogs. Applying settings restarts the viewer.';
  }
}catch(e){$('progress').textContent=e.message;}

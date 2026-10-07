const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('viewer',{
  setupCancel:()=>ipcRenderer.invoke('setup-cancel'),
  setupBack:()=>ipcRenderer.invoke('setup-back'),
  setupInfo:()=>ipcRenderer.invoke('setup-info'),setupFolder:()=>ipcRenderer.invoke('setup-folder'),setupStart:value=>ipcRenderer.invoke('setup-start',value),settings:()=>ipcRenderer.invoke('open-settings'),
  designerOptions:value=>ipcRenderer.invoke('designer-options',value),importNpc:id=>ipcRenderer.invoke('designer-import',id),
  equipment:query=>ipcRenderer.invoke('equipment',query),
  npcs:query=>ipcRenderer.invoke('npcs',query),previewNpc:(id,selection)=>ipcRenderer.invoke('npc-preview',id,selection),exportNpc:(id,selection)=>ipcRenderer.invoke('export-npc-fbx',id,selection),
  catalog:body=>ipcRenderer.invoke('catalog',body),preview:state=>ipcRenderer.invoke('preview',state),
  assets:query=>ipcRenderer.invoke('assets',query),previewAsset:(id,selection)=>ipcRenderer.invoke('asset-preview',id,selection),
  exportAsset:(id,selection)=>ipcRenderer.invoke('export-asset-fbx',id,selection),
  save:state=>ipcRenderer.invoke('save-preset',state),load:()=>ipcRenderer.invoke('load-preset'),export:state=>ipcRenderer.invoke('export-fbx',state),
  progress:callback=>ipcRenderer.on('progress',(_,message)=>callback(message)),
  smoke:result=>ipcRenderer.invoke('smoke-result',result)
});

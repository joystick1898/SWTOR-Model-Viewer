const {app,BrowserWindow}=require('electron');
const fs=require('fs'),path=require('path');
app.whenReady().then(async()=>{
 try{
  const folder=path.resolve('output/equipment-review');fs.mkdirSync(folder,{recursive:true});
  const report=JSON.parse(fs.readFileSync('reports/equipment-material-regression.json'));
  const html=`<html><body style="margin:0"><script type="importmap">{"imports":{"three":"../../node_modules/three/build/three.module.js","three/addons/":"../../node_modules/three/examples/jsm/"}}</script><script type="module">
  import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
  window.draw=async(data)=>{
   const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0)),g=await new GLTFLoader().parseAsync(bytes.buffer,'');
   const scene=new T.Scene();scene.background=new T.Color('#283039');scene.add(g.scene);g.scene.updateMatrixWorld(true);
   const box=new T.Box3().setFromObject(g.scene),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),extent=Math.max(size.x,size.y,size.z);
   const camera=new T.PerspectiveCamera(35,1,.0001,extent*20);camera.position.copy(center).add(new T.Vector3(extent*.25,extent*.05,extent*1.9));camera.lookAt(center);
   const light=new T.DirectionalLight(0xffffff,2.5);light.position.copy(center).add(new T.Vector3(extent,extent*2,extent*3));scene.add(light,new T.HemisphereLight(0xffffff,0x555555,2));
   const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(700,700);document.body.replaceChildren(renderer.domElement);renderer.render(scene,camera);renderer.getContext().finish();
   return {size:size.toArray(),meshes:g.scene.children.length};
  };window.ready=true;
  </script></body></html>`;
  fs.writeFileSync(path.join(folder,'review.html'),html);
  const win=new BrowserWindow({width:700,height:700,show:false,webPreferences:{offscreen:true}});await win.loadFile(path.join(folder,'review.html'));
  for(const result of report.results.filter(r=>r.mode==='preview')){
   console.log(result.body,await win.webContents.executeJavaScript('window.draw('+JSON.stringify(fs.readFileSync(result.file).toString('base64'))+')'));
   await new Promise(resolve=>setTimeout(resolve,200));fs.writeFileSync(path.join(folder,result.body+'.png'),(await win.webContents.capturePage()).toPNG());
  }
  app.exit(0);
 }catch(error){console.error(error);app.exit(1);}
});

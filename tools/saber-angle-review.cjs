const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');const path=require('node:path');
app.whenReady().then(async()=>{try{
 const folder=path.resolve('output/persistent-sabers');
 const html=`<!doctype html><html><head><script type="importmap">{"imports":{"three":"../../node_modules/three/build/three.module.js"}}</script></head><body style="margin:0"><script type="module">
 import * as THREE from 'three';import {GLTFLoader} from '../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';import {saberFXMaterial} from '../../src/renderer/saber-fx-material.js';
 try{
 const records=await (await fetch('result.json')).json();const details=new Map(records.materialDetails.map(m=>[m.name,m]));
 const scene=new THREE.Scene();scene.background=new THREE.Color('#10151b');
 const root=(await new GLTFLoader().loadAsync('persistent.glb')).scene;scene.add(root);
 root.traverse(o=>{if(!o.isMesh)return;const r=details.get(o.material.name);o.material=saberFXMaterial(o.material,r);o.material.uniforms.fps.value=0;o.renderOrder=r.saberFX.channel==='core'?1:2;});
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(480,600);renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.append(renderer.domElement);
 const camera=new THREE.OrthographicCamera(-.055,.055,.069,-.069,.00001,10);
 window.capture=(family,angle,azimuth=0)=>{
  const box=new THREE.Box3();root.traverse(o=>{if(!o.isMesh)return;o.visible=o.name.startsWith('equipment_'+family+'_');if(o.visible){o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const axis=size.y>size.x&&size.y>size.z?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
  const side=new THREE.Vector3(1,0,0).applyAxisAngle(axis,azimuth*Math.PI/180);
  const radians=angle*Math.PI/180,view=side.multiplyScalar(Math.sin(radians)).addScaledVector(axis,Math.cos(radians));
  camera.position.copy(center).addScaledVector(view,.5);camera.up.copy(Math.abs(Math.cos(radians))>.999?new THREE.Vector3(0,1,0):axis);if(Math.abs(camera.up.dot(view))>.999)camera.up.set(1,0,0);camera.lookAt(center);renderer.render(scene,camera);
  const gl=renderer.getContext(),pixels=new Uint8Array(480*600*4);gl.readPixels(0,0,480,600,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let peak=0,bright=0;for(let i=0;i<pixels.length;i+=4){const value=Math.max(pixels[i],pixels[i+1],pixels[i+2]);peak=Math.max(peak,value);if(value>128)bright++;}
  return {family,angle,azimuth,peak,bright,png:renderer.domElement.toDataURL('image/png').split(',')[1],error:gl.getError()};
 };
 }catch(e){window.failure=String(e);}window.ready=true;
 </script></body></html>`;
 await fs.writeFile(path.join(folder,'angles.html'),html);
 const win=new BrowserWindow({show:false,webPreferences:{offscreen:true}});win.webContents.on('console-message',(_e,...args)=>console.log(...args));await win.loadFile(path.join(folder,'angles.html'));
 for(let i=0;i<120;i++){if(await win.webContents.executeJavaScript('Boolean(window.ready)'))break;await new Promise(r=>setTimeout(r,250));}
 const failure=await win.webContents.executeJavaScript('window.failure');if(failure)throw Error(failure);
 const results=[];
 for(let family=0;family<9;family++)for(const angle of [90,45,10,0,180])for(const azimuth of angle===90?[0,7.5,15,22.5]:[0]){
  const result=await win.webContents.executeJavaScript('(()=>{try{return window.capture('+[family,angle,azimuth].join(',')+')}catch(e){return {failure:e.stack}}})()');
  if(result.failure)throw Error(result.failure);await fs.writeFile(path.join(folder,'angle-'+family+'-'+angle+'-'+azimuth+'.png'),Buffer.from(result.png,'base64'));delete result.png;results.push(result);
 }
 await fs.writeFile(path.join(folder,'angle-check.json'),JSON.stringify(results,null,2));
 const failures=results.filter(r=>r.peak<150||r.bright<3||r.error);if(failures.length)throw Error(JSON.stringify(failures));
 console.log('SABER_ANGLE_PASS',results.length,'views');win.destroy();app.exit(0);
 }catch(e){console.error(e);app.exit(1);}});

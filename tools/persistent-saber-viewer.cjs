const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');const path=require('node:path');
app.whenReady().then(async()=>{try{
 const folder=path.resolve('output/persistent-sabers');
 const html=`<!doctype html><html><head><script type="importmap">{"imports":{"three":"../../node_modules/three/build/three.module.js"}}</script></head><body style="margin:0"><script type="module">
 import * as THREE from 'three';import {GLTFLoader} from '../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';import {saberFXMaterial} from '../../src/renderer/saber-fx-material.js';
 try{
 const record=await (await fetch('character-preview.json')).json();const details=new Map(record.materialDetails.map(m=>[m.name,m]));
 const scene=new THREE.Scene();scene.background=new THREE.Color('#13131a');
 const gltf=await new GLTFLoader().loadAsync('character.glb');const root=gltf.scene;scene.add(root);if(gltf.animations.length){const mixer=new THREE.AnimationMixer(root);gltf.animations.forEach(c=>mixer.clipAction(c).play());mixer.setTime(.2);root.updateMatrixWorld(true);}
 let count=0;const fxMaterials=[];root.traverse(o=>{if(!o.isMesh)return;const array=Array.isArray(o.material);const input=array?o.material:[o.material];const output=input.map(m=>{const r=details.get(m.name);if(!r?.saberFX)return m;count++;o.renderOrder=r.saberFX.channel==='core'?1:2;const fx=saberFXMaterial(m,r);fxMaterials.push(fx);return fx;});o.material=array?output:output[0];});
 if(!count)throw Error('No FX materials loaded');
 const box=new THREE.Box3().setFromObject(root);const center=box.getCenter(new THREE.Vector3());const extent=box.getSize(new THREE.Vector3()).length();
 const camera=new THREE.PerspectiveCamera(35,1000/900,.00001,extent*20);camera.position.copy(center).add(new THREE.Vector3(extent*.1,extent*.1,extent*1.5));camera.lookAt(center);
 scene.add(new THREE.HemisphereLight(0xffffff,0x444444,2));
 // Avoid driver-dependent MSAA resolve noise in the exact static-frame check.
 const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(1000,900);renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.append(renderer.domElement);
 const pixels=()=>{const gl=renderer.getContext(),data=new Uint8Array(1000*900*4);gl.readPixels(0,0,1000,900,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;};
 renderer.render(scene,camera);const a=pixels();fxMaterials.forEach(m=>m.uniforms.clock.value=.37);renderer.render(scene,camera);const b=pixels();let changed=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>3)changed++;
 if(changed<10)throw Error('Animated texture frames did not change: '+changed);
 fxMaterials.forEach(m=>{m.uniforms.fps.value=0;m.uniforms.clock.value=0;});renderer.render(scene,camera);const c=pixels();fxMaterials.forEach(m=>m.uniforms.clock.value=10);renderer.render(scene,camera);const d=pixels();let staticChanged=0,maxStaticDelta=0;for(let i=0;i<c.length;i+=4){const delta=Math.abs(c[i]-d[i])+Math.abs(c[i+1]-d[i+1])+Math.abs(c[i+2]-d[i+2]);maxStaticDelta=Math.max(maxStaticDelta,delta);if(delta>3)staticChanged++;}if(staticChanged>0)throw Error('Static frame moved: '+staticChanged+' max '+maxStaticDelta);
 window.review={ok:true,fxMeshes:count,animatedChangedPixels:changed,staticUnchanged:true,glError:renderer.getContext().getError()};window.ready=true;
 }catch(e){window.failure=String(e);window.ready=true;}
 </script></body></html>`;
 await fs.writeFile(path.join(folder,'viewer.html'),html);
 const win=new BrowserWindow({width:1000,height:900,show:false,webPreferences:{offscreen:true}});const errors=[];win.webContents.on('console-message',(_e,...args)=>{const text=args.map(x=>typeof x==='object'?JSON.stringify(x):String(x)).join(' ');if(/ERROR|VALIDATE_STATUS|Error:/.test(text))errors.push(text);});
 await win.loadFile(path.join(folder,'viewer.html'));
 for(let i=0;i<120;i++){if(await win.webContents.executeJavaScript('Boolean(window.ready)'))break;await new Promise(r=>setTimeout(r,250));}
 const result=await win.webContents.executeJavaScript('({review:window.review,failure:window.failure,ready:window.ready})');if(result.failure||!result.ready||errors.length)throw Error(JSON.stringify({result,errors}));
 await fs.writeFile(path.join(folder,'viewer-check.json'),JSON.stringify(result.review,null,2));await fs.writeFile(path.join(folder,'viewer-character.png'),(await win.webContents.capturePage()).toPNG());
 console.log('PERSISTENT_SABER_VIEWER_PASS',result.review);win.destroy();app.exit(0);
}catch(e){console.error(e);app.exit(1);}});

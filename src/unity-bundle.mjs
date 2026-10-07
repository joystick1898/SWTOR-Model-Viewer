import {writeSaberShader,writeSaberFXShader} from './saber-unity.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
async function guid(file){try{const old=await fs.readFile(file+'.meta','utf8');const match=old.match(/^guid: ([a-f0-9]{32})$/m);if(match)return match[1];}catch{}return randomUUID().replaceAll('-','');}
const quote=JSON.stringify;
export async function writeUnityAssets(destination,manifest){
  const directory=path.dirname(destination),folder=path.basename(destination,'.fbx')+'.materials';
  await fs.mkdir(path.join(directory,folder),{recursive:true});
  const saberShader=manifest.materials.some(m=>m.family==='Saber')?await writeSaberShader(path.join(directory,folder),guid):null;
  const saberFXShader=manifest.materials.some(m=>m.family==='SaberFX')?await writeSaberFXShader(path.join(directory,folder),guid):null;
  const textures=new Map(),remaps=[];
  const safeName=name=>name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_');
  const nameCounts=new Map();
  for(const surface of manifest.materials){const key=safeName(surface.name).toLowerCase();nameCounts.set(key,(nameCounts.get(key)||0)+1);}
  for(const surface of manifest.materials){
    for(const [channel,relative] of Object.entries(surface.textures)){
      if(textures.has(relative))continue;
      const file=path.join(directory,relative),id=await guid(file),normal=channel==='normal',linear=normal||channel==='roughness';textures.set(relative,id);
      const maxSize=Math.max(2048,2**Math.ceil(Math.log2(Math.max(...(surface.textureDimensions?.[channel]??[2048])))));
      await fs.writeFile(file+'.meta',`fileFormatVersion: 2\nguid: ${id}\nTextureImporter:\n  serializedVersion: 13\n  internalIDToNameTable: []\n  externalObjects: {}\n  mipmaps:\n    enableMipMap: ${surface.saberFX?0:1}\n    sRGBTexture: ${linear?0:1}\n  bumpmap:\n    convertToNormalMap: 0\n    flipGreenChannel: 0\n  isReadable: 0\n  textureType: ${normal?1:0}\n  textureShape: 1\n  maxTextureSize: ${maxSize}\n  npotScale: 0\n  platformSettings:\n  - serializedVersion: 3\n    buildTarget: DefaultTexturePlatform\n    maxTextureSize: ${maxSize}\n    resizeAlgorithm: 0\n    textureFormat: -1\n    textureCompression: 0\n    compressionQuality: 100\n    crunchedCompression: 0\n    allowsAlphaSplitting: 0\n    overridden: 0\n  alphaUsage: 1\n  alphaIsTransparency: ${channel==='base'&&surface.alphaMode==='cutout'?1:0}\n  textureSettings:\n    serializedVersion: 2\n    filterMode: 1\n    aniso: 4\n    wrapU: 0\n    wrapV: 0\n    wrapW: 0\n`);
    }
    // Windows filenames are case-insensitive; sanitization can also merge names.
    const base=safeName(surface.name),suffix=nameCounts.get(base.toLowerCase())>1?'-'+createHash('sha256').update(surface.name).digest('hex'):'';
    const file=path.join(directory,folder,base+suffix+'.mat'),id=await guid(file),cutout=surface.alphaMode==='cutout',additive=surface.alphaMode==='additive',blend=surface.alphaMode==='blend'||additive;
    const tex=(property,channel)=>`    - ${property}:\n        m_Texture: {fileID: 2800000, guid: ${textures.get(surface.textures[channel])}, type: 3}\n        m_Scale: {x: 1, y: 1}\n        m_Offset: {x: 0, y: 0}\n`;
    const saber=surface.family==='Saber',glow=saber&&surface.saberChannel==='glow';
    const fx=surface.saberFX;const baseColor=[1,3,5].map(i=>parseInt((fx?.baseColor??'#ffffff').slice(i,i+2),16)/255);
    // Reflection strength and smoothness remain editable scalar properties.
    const spec=surface.specular??0;
    await fs.writeFile(file,`%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n--- !u!21 &2100000\nMaterial:\n  serializedVersion: 8\n  m_ObjectHideFlags: 0\n  m_Name: ${quote(surface.name)}\n  m_Shader: ${fx?`{fileID: 4800000, guid: ${saberFXShader}, type: 3}`:saber?`{fileID: 4800000, guid: ${saberShader}, type: 3}`:`{fileID: ${additive?200:45}, guid: 0000000000000000f000000000000000, type: 0}`}\n  m_ValidKeywords:\n  - _NORMALMAP\n  - _EMISSION\n${cutout?'  - _ALPHATEST_ON\n':blend?'  - _ALPHABLEND_ON\n':''}  m_InvalidKeywords: []\n  m_LightmapFlags: 4\n  m_CustomRenderQueue: ${fx?(fx.channel==='core'?3000:3001):saber?(glow?3000:2000):cutout?2450:blend?3000:-1}\n  stringTagMap:\n    RenderType: ${cutout?'TransparentCutout':blend?'Transparent':'Opaque'}\n  m_SavedProperties:\n    serializedVersion: 3\n    m_TexEnvs:\n${tex('_MainTex','base')}${tex('_BumpMap','normal')}${tex('_EmissionMap','emission')}    m_Floats:\n    - _Base: ${fx?.base?1:0}\n    - _Cull: ${fx?.base?2:0}\n    - _Tau: ${fx?.tau?1:0}\n    - _Columns: ${fx?.columns??1}\n    - _Rows: ${fx?.rows??1}\n    - _Frame: ${fx?.frame??0}\n    - _FPS: ${fx?.animated?fx.fps:0}\n    - _Direction: ${fx?.direction??1}\n    - _Intensity: ${surface.saberIntensity??1.5}\n    - _Glow: ${glow?1:0}\n    - _Effect: ${surface.saberEffect==='unstable'?1:surface.saberEffect==='pulsing'?2:0}\n    - _Mode: ${cutout?1:blend?2:0}\n    - _Cutoff: ${surface.alphaCutoff??.5}\n    - _Glossiness: ${1-(surface.roughness??.65)}\n    - _GlossMapScale: 1\n    - _SmoothnessTextureChannel: 0\n    - _SpecularHighlights: 1\n    - _GlossyReflections: 1\n    - _BumpScale: 1\n    - _SrcBlend: ${fx?5:saber||additive?1:blend?5:1}\n    - _DstBlend: ${glow||additive?1:blend?10:0}\n    - _ZWrite: ${blend?0:1}\n    m_Colors:\n    - _BaseColor: {r: ${baseColor[0]}, g: ${baseColor[1]}, b: ${baseColor[2]}, a: 1}\n    - _TintColor: {r: 0.5, g: 0.5, b: 0.5, a: 0.5}\n    - _Color: {r: 1, g: 1, b: 1, a: 1}\n    - _SpecColor: {r: ${spec}, g: ${spec}, b: ${spec}, a: 1}\n    - _EmissionColor: {r: 1, g: 1, b: 1, a: 1}\n`);
    await fs.writeFile(file+'.meta',`fileFormatVersion: 2\nguid: ${id}\nNativeFormatImporter:\n  externalObjects: {}\n  mainObjectFileID: 2100000\n`);
    remaps.push(`  - first:\n      type: UnityEngine:Material\n      assembly: UnityEngine.CoreModule\n      name: ${quote(surface.name)}\n    second: {fileID: 2100000, guid: ${id}, type: 2}\n`);
  }
  const id=await guid(destination);
  await fs.writeFile(destination+'.meta',`fileFormatVersion: 2\nguid: ${id}\nModelImporter:\n  serializedVersion: 24200\n  internalIDToNameTable: []\n  externalObjects:${remaps.length?'\n'+remaps.join(''):' []\n'}  materials:\n    materialImportMode: 2\n    materialLocation: 1\n  animations:\n    optimizeGameObjects: 0\n  meshes:\n    globalScale: 1\n    useFileUnits: 1\n  importAnimation: 0\n  animationType: ${manifest.rigged?2:0}\n`);
  return folder;
}

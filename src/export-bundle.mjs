import fs from 'node:fs/promises';
import path from 'node:path';
import {writeUnityAssets} from './unity-bundle.mjs';

// FBX embeds textures. A companion directory also makes them directly usable in Unity.
export async function writeExportBundle(result,state,destination){
  const textureDirectory=path.basename(destination,path.extname(destination))+'.textures';
  const folder=path.join(path.dirname(destination),textureDirectory);
  await fs.mkdir(folder,{recursive:true});
  for(const file of result.textureFiles)await fs.copyFile(file,path.join(folder,path.basename(file)));
  await fs.copyFile(result.file,destination);
  const manifest={version:2,generator:'swtor-model-viewer',preset:state,clip:result.clip,profile:result.profile,rigged:result.rigged,boneCount:result.boneCount,
    sourceAnimationProfile:result.sourceAnimationProfile,secondaryAttachments:result.secondaryAttachments,effectWarnings:result.equipmentWarnings??[],
    geometry:result.rigged?'skinned mesh with selected pose as editable bind pose':'static posed mesh',scale:'source units; Unity/TTS scale validation pending',
    materials:result.materialDetails.map(m=>({...m,textures:Object.fromEntries(Object.entries(m.textures).map(([k,v])=>[k,textureDirectory+'/'+path.basename(v)]))})),
    materialPolicy:{alpha:'cutout',alphaCutoff:.5,hairAlphaCutoff:.75,cutoffSource:'per-material alphaCutoff',normal:'tangent space; Non-Color',roughness:'approximate',color:'sRGB',resolution:'native',specular:'constant only; no specular or roughness maps'}};
  manifest.unityMaterials=await writeUnityAssets(destination,manifest);
  if(manifest.materials.some(m=>m.saberFX))manifest.saberEffects={scope:'persistent blade artwork only',animation:'native texture flipbooks in a custom Built-in Render Pipeline shader; no runtime scripts',excluded:['ignition','shutdown','motion trails','impacts'],fallback:'FBX UVs select the chosen static frame',limitations:['angle-normalized radial overlays and solid cores approximate native billboards','particle movement and native size/color curves are not simulated','native AnimationSpeed is interpreted as seconds per frame; exact game timing is unverified','cross-platform shader compatibility remains unverified']};
  await fs.writeFile(destination+'.json',JSON.stringify(manifest,null,2));
  await fs.writeFile(path.join(path.dirname(destination),'UNITY_IMPORT.txt'),
    'Copy the FBX, its .meta and .fbx.json files, and both .textures and .materials folders (including every .meta) together into Assets.\nThe FBX contains embedded materials/textures; the companion Unity materials are already mapped, and texture .meta files mark normals as NormalMap. No extraction or preparation command is needed for a new import into the Built-in Render Pipeline.\nMaterials use Standard (Specular setup) with native-resolution base, normal and emission textures. Specular and smoothness are editable scalar settings; no reflection maps are exported. Import textures uncompressed for visual review.\nNo Unity C# helper script is required or included. Saber exports include SWTORSaberFX.shader (native persistent effects) or SWTORSaber.shader (smooth fallback) in the materials folder; copy the shader and its .meta too. The materials select the custom Built-in Render Pipeline shader automatically. Native saber materials play texture frames only when Animated crackle was selected; _FPS=0 holds the exported static frame. Shader animation needs no Animator, ParticleSystem or runtime C# script. The FBX alone carries fixed-frame UVs, not shader animation. No ignition, shutdown, swing trails or impacts are exported.\nThe selected pose is exported without an animation clip. An included skeleton remains manually poseable.\nPersistent texture effects were checked in Unity 6000.3.10f1. The user reported successful TTS use of the previous effect export. These revised effects still need in-game acceptance; cross-platform custom shader compatibility and URP/HDRP configuration remain unverified.\n');
  return manifest;
}

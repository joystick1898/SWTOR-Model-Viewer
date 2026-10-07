import fs,{resolvedResource,recoverSources} from './resource-files.mjs';
import path from 'node:path';
import {animationLibrary,decodeAssetMotion} from './animation-library.mjs';
const indexes=new Map();
const xmlText=s=>s?.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&apos;',"'");
const clean=s=>s.replaceAll('\\','/').replace(/^\//,'');
export function resourcePath(root,relative){
  const resolved=path.resolve(root,relative);
  if(!resolved.startsWith(path.resolve(root)+path.sep))throw Error('Resource outside source folder');
  return resolvedResource(resolved);
}
async function index(root,category){
  const file=resourcePath(root,`art/dynamic/${category}/index.xml`);
  if(!indexes.has(file))indexes.set(file,(async()=>{
    let xml;try{xml=await fs.readFile(file,'utf8');}catch{return new Map();}
    const entries=new Map(),attachments=[];
    for(const m of xml.matchAll(/<Asset>([\s\S]*?)<\/Asset>/g)){
      const body=m[1],source=xmlText(body.match(/<BaseFile>(.*?)<\/BaseFile>/)?.[1]);if(!source)continue;
      const previous=entries.get(clean(source));
      const materials=[...body.matchAll(/<Material\s[^>]*filename="([^"]+)"/g)].map(m=>clean(xmlText(m[1])));
      const overrides={...previous?.materialOverrides};
      for(const material of body.matchAll(/<Material\s[^>]*filename="([^"]+)"[^>]*>([\s\S]*?)<\/Material>/g))overrides[clean(xmlText(material[1]))]=[...material[2].matchAll(/<MaterialOverride\s[^>]*filename="([^"]+)"/g)].map(m=>clean(xmlText(m[1])));
      const bodyTypes=[...body.matchAll(/<Bodytype>(.*?)<\/Bodytype>/g)].map(m=>xmlText(m[1]));
      entries.set(clean(source),{sourceIndex:`art/dynamic/${category}/index.xml`,materials:[...new Set([...(previous?.materials||[]),...materials])],materialOverrides:overrides,bodyTypes:[...new Set([...(previous?.bodyTypes||[]),...bodyTypes])]});
      for(const attachment of body.matchAll(/<Attachment\s[^>]*filename="([^"]+)"/g))attachments.push([clean(xmlText(attachment[1])),clean(source)]);
    }
    for(const [attachment,base] of attachments)if(!entries.has(attachment))entries.set(attachment,{...entries.get(base),parentAsset:base});
    return entries;
  })());
  return indexes.get(file);
}
export async function assetMetadata(root,asset){
  const creatureIndex=await index(root,'creature');
  let entry=(await index(root,asset.category)).get(asset.id)||creatureIndex.get(asset.id);
  if(!entry){
    const matches=[...creatureIndex].filter(([id])=>path.posix.basename(id)===path.posix.basename(asset.id));
    const profiles=new Set(matches.map(([,value])=>JSON.stringify(value.bodyTypes)));
    if(matches.length&&profiles.size===1){
      try{
        const [candidate,original]=await Promise.all([fs.readFile(resourcePath(root,asset.id)),fs.readFile(resourcePath(root,matches[0][0]))]);
        if(candidate.equals(original))entry={...matches[0][1],association:'byte-identical native model'};
      }catch{}
    }
  }
  const result={...asset,materials:entry?.materials||[],materialOverrides:entry?.materialOverrides||{},parentAsset:entry?.parentAsset||null,association:entry?.association||'native index',clips:[],unsupportedClips:[],profile:null,skeleton:null,animationDirectory:null,sourceIndex:entry?.sourceIndex||null,animationSupported:false};
  await recoverSources(root,result.materials);
  const available=await Promise.all(result.materials.map(async m=>{try{await fs.access(resourcePath(root,m));return m;}catch{return null;}}));
  result.missingMaterials=result.materials.filter(m=>!available.includes(m));result.materials=available.filter(Boolean);
  for(const body of entry?.bodyTypes||[]){
    if(!/^[a-z0-9_]+$/i.test(body))continue;
    try{
      await recoverSources(root,[`art/dynamic/spec/${body}.dat`,`art/dynamic/spec/${body}.dyc`]);
      const dat=await fs.readFile(resourcePath(root,`art/dynamic/spec/${body}.dat`),'utf8');
      const dyc=await fs.readFile(resourcePath(root,`art/dynamic/spec/${body}.dyc`),'utf8');
      const skeleton=dyc.match(/^\s*Skeleton=(\S+)/m)?.[1],directory=dat.match(/^\s*AnimNetworkFolder=(\S+)/m)?.[1];
      if(!skeleton||!directory)continue;
      const skel=`art/dynamic/spec/${clean(skeleton)}`,anim=clean(directory).replace(/\/$/,'');
      await recoverSources(root,[skel]);
      await fs.access(resourcePath(root,skel));
      const library=await animationLibrary(root,anim),clips=library.clips,unsupportedClips=library.unsupported;
      Object.assign(result,{profile:body,skeleton:skel,animationDirectory:anim,clips,unsupportedClips,animationSupported:clips.length>unsupportedClips.length,mappingSignature:library.signature});break;
    }catch{}
  }
  return result;
}
export async function assetMotion(root,metadata,clip){
  if(!metadata.clips.includes(clip))throw Error('Animation is not associated with this resource');
  if(!metadata.animationSupported)throw Error('This resource has animation references, but its track mapping is not validated yet');
  return decodeAssetMotion(root,metadata.animationDirectory,clip);
}

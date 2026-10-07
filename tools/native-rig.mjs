// Experimental MAWB v2 rig reader. All offsets checked against the file bounds.
export function readNativeRig(b) {
  return readRigPayload(b,24,true);
}
function readRigPayload(b,base,wrapper=false,validateHierarchy=true) {
  const check=(v,m)=>{if(!v)throw Error(m);};
  const u=p=>b.readUInt32LE(p), pointer=p=>{const n=Number(b.readBigUInt64LE(p))+base;check(Number.isSafeInteger(n)&&n>=0&&n<b.length,'Invalid rig pointer');return n;};
  check(b.length>=base+80&&(!wrapper||(b.toString('ascii',0,4)==='MAWB'&&u(4)===2)),'Unsupported native rig');
  const table=pointer(base+32), rotations=pointer(base+40), translations=pointer(base+48), count=u(base+64);
  check(count>0&&count<4096&&u(table)===count,'Inconsistent rig name count');
  const offsets=table+Number(b.readBigUInt64LE(table+16)), strings=table+Number(b.readBigUInt64LE(table+24));
  const bones=Array.from({length:count},(_,i)=>{
    const start=strings+u(offsets+i*4), end=b.indexOf(0,start);
    check(start>=strings&&end>=start&&end-start<256,'Invalid rig bone name');
    const name=b.toString('utf8',start,end), t=Array.from({length:3},(_,j)=>b.readFloatLE(translations+i*16+j*4));
    const xyzw=Array.from({length:4},(_,j)=>b.readFloatLE(rotations+i*16+j*4));
    check(t.every(Number.isFinite)&&xyzw.every(Number.isFinite)&&Math.abs(Math.hypot(...xyzw)-1)<0.001,'Invalid bind transform');
    return {name,parent:b.readInt32LE(base+80+i*4),translation:t,rotation:[xyzw[3],...xyzw.slice(0,3)]};
  });
  check(new Set(bones.map(b=>b.name)).size===count,'Duplicate native bone names');
  if(validateHierarchy){
    check(bones.every((bone,i)=>bone.parent===-1||(bone.parent>=0&&bone.parent<count&&bone.parent!==i)),'Invalid rig hierarchy');
    for(let i=0;i<count;i++){const visited=new Set();for(let p=i;p!==-1;p=bones[p].parent){check(!visited.has(p),'Cyclic rig hierarchy');visited.add(p);}}
  }
  return {format:'MAWB-v2',bones};
}

export function readNativeNetwork(b){
  const check=(v,m)=>{if(!v)throw Error(m);};
  check(b.toString('ascii',0,4)==='MAWB'&&b.readUInt32LE(4)===2,'Unsupported native network');
  const chunks=new Map();let pos=8;
  while(pos+16<=b.length){
    const type=b.readUInt32LE(pos),id=b.readUInt32LE(pos+4),size=Number(b.readBigUInt64LE(pos+8));
    check(Number.isSafeInteger(size)&&size>=0&&pos+16+size<=b.length,'Invalid network chunk');
    chunks.set(id,{type,data:b.subarray(pos+16,pos+16+size)});pos=8+Math.ceil((pos+16+size-8)/16)*16;
  }
  const rigs=new Map(),maps=new Map(),clips=[];
  for(const [id,{type,data}] of chunks){
    // Reduced LOD rigs retain parent indices from the full rig. Playback uses
    // only their named local bind transforms, never these parent indices.
    if(type===2){try{rigs.set(id,readRigPayload(data,0,false,false));}catch(e){if(id===0)throw e;}}
    if(type===3){
      const count=data.readUInt32LE(0),start=Number(data.readBigUInt64LE(8));
      check(count>0&&count<4096&&start+count*4<=data.length,'Invalid native track map');
      maps.set(id,Array.from({length:count},(_,i)=>({rig:data.readUInt16LE(start+i*4),track:data.readUInt16LE(start+i*4+2)})));
    }
  }
  for(const {type,data} of chunks.values())if(type===1){
    const ptr=(at,base=0)=>{const n=base+Number(data.readBigUInt64LE(at));check(Number.isSafeInteger(n)&&n>=0&&n<data.length,'Invalid network reference');return n;};
    const table=ptr(16),count=data.readUInt32LE(table),ids=ptr(table+8,table),offsets=ptr(table+16,table),strings=ptr(table+24,table),names=new Map();
    check(count<100000&&ids+count*4<=data.length&&offsets+count*4<=data.length,'Invalid clip table');
    for(let i=0;i<count;i++){const start=strings+data.readUInt32LE(offsets+i*4),end=data.indexOf(0,start);check(start>=strings&&end>=start&&end-start<512,'Invalid clip name');names.set(data.readUInt32LE(ids+i*4),data.toString('utf8',start,end));}
    const rigCount=data.readUInt32LE(0),rigTable=ptr(8);check(rigCount>0&&rigCount<128,'Invalid network rig count');
    for(let i=0;i<rigCount;i++){
      const start=ptr(rigTable+i*8),rigId=data.readUInt32LE(start),rig=rigs.get(rigId),n=data.readUInt32LE(start+16),records=ptr(start+24,start);
      if(!rig)continue;
      check(n<100000&&records+n*88<=data.length,'Invalid animation records');
      for(let j=0;j<n;j++){
        const record=records+j*88,name=names.get(data.readUInt32LE(record+80)),mapId=data.readUInt32LE(record+84),map=maps.get(mapId);
        check(name&&map,'Missing native animation map');
        const bones=[];for(const pair of map){check(pair.rig<rig.bones.length&&pair.track<4096&&!bones[pair.track],'Invalid bone mapping');bones[pair.track]=rig.bones[pair.rig];}
        // Lower-detail networks omit animation tracks. The full-detail record
        // supplies the complete map; do not mistake sparse LOD maps for clips.
        if(bones.length===map.length&&Array.from(bones).every(Boolean))clips.push({name:name+'.jba',bones,rigId,mapId});
      }
    }
  }
  return {rigs,clips};
}
export function mapBmnTracks(rig,trackCount) {
  // Explicit bmnnew profile, not a general clip-to-rig remapper. Validated against
  // the supplied 102-track legacy labels; 105-track variant still provisional.
  if(rig.bones.length!==106||rig.bones[0].name!=='CharacterWorldSpaceTM')throw Error('Unsupported bmn rig');
  const omitted=new Set(['fc_wrinkle1','fc_wrinkle2','fc_wrinkle3']);
  const mapped=rig.bones.slice(1).filter(b=>trackCount===105||!omitted.has(b.name));
  if(![102,105].includes(trackCount)||mapped.length!==trackCount)throw Error('Unsupported bmn track layout');
  return mapped;
}

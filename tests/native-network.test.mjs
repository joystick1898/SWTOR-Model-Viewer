import test from 'node:test';
import assert from 'node:assert/strict';
import {readNativeNetwork} from '../tools/native-rig.mjs';

// Synthetic assets: no game files are distributed with these tests.
function network(legacy){
  const ptr=(b,p,v)=>legacy?b.writeUInt32LE(v,p):b.writeBigUInt64LE(BigInt(v),p);
  const rig=Buffer.alloc(512);
  ptr(rig,legacy?28:32,128);ptr(rig,legacy?32:40,320);ptr(rig,legacy?36:48,352);
  rig.writeUInt32LE(2,legacy?48:64);
  rig.writeInt32LE(-1,legacy?56:80);rig.writeInt32LE(0,legacy?60:84);
  rig.writeUInt32LE(2,128);
  ptr(rig,128+(legacy?12:16),32);ptr(rig,128+(legacy?16:24),48);
  rig.writeUInt32LE(0,160);rig.writeUInt32LE(5,164);rig.write('root\0child\0',176);
  rig.writeFloatLE(1,332);rig.writeFloatLE(1,348);rig.writeFloatLE(7,368);
  const map=Buffer.alloc(32);map.writeUInt32LE(2);ptr(map,legacy?4:8,16);
  // Deliberately reverse rig order to catch readers that ignore track maps.
  map.writeUInt16LE(1,16);map.writeUInt16LE(0,18);map.writeUInt16LE(0,20);map.writeUInt16LE(1,22);
  const data=Buffer.alloc(512);data.writeUInt32LE(1);ptr(data,legacy?4:8,32);ptr(data,legacy?8:16,256);
  ptr(data,32,64);data.writeUInt32LE(0,64);data.writeUInt32LE(1,64+(legacy?8:16));ptr(data,64+(legacy?12:24),64);
  data.writeUInt32LE(0,128+(legacy?44:80));data.writeUInt32LE(1,128+(legacy?48:84));
  data.writeUInt32LE(1,256);ptr(data,264,32);ptr(data,256+(legacy?12:16),40);ptr(data,256+(legacy?16:24),48);
  data.write('test_clip\0',304);
  const chunk=(type,id,data)=>{const b=Buffer.alloc(16+Math.ceil(data.length/16)*16);b.writeUInt32LE(type);b.writeUInt32LE(id,4);b.writeBigUInt64LE(BigInt(data.length),8);data.copy(b,16);return b;};
  const header=legacy?Buffer.alloc(0):Buffer.from([77,65,87,66,2,0,0,0]);
  return Buffer.concat([header,chunk(2,0,rig),chunk(3,1,map),chunk(1,2,data)]);
}

test('32-bit and MAWB networks preserve identical explicit track order and bind transforms',()=>{
  const a=readNativeNetwork(network(true)),b=readNativeNetwork(network(false));
  assert.deepEqual(a,b);
  assert.equal(a.clips[0].name,'test_clip.jba');
  assert.deepEqual(a.clips[0].bones.map(b=>b.name),['child','root']);
  assert.deepEqual(a.clips[0].bones[0].translation,[7,0,0]);
});
for(const legacy of [true,false])test(`rejects truncated and invalid maps (${legacy?'32':'64'}-bit)`,()=>{
  const b=network(legacy);
  assert.throws(()=>readNativeNetwork(b.subarray(0,b.length-40)));
  const invalid=Buffer.from(b),origin=legacy?0:8;
  invalid.writeUInt16LE(99,origin+528+16+16);
  assert.throws(()=>readNativeNetwork(invalid),/Invalid bone mapping/);
});
test('rejects unknown and short formats',()=>{
  for(const b of [Buffer.alloc(0),Buffer.alloc(7),Buffer.alloc(100)])assert.throws(()=>readNativeNetwork(b),/Unsupported native network/);
});

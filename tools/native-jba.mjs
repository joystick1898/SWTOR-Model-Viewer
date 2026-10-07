// Experimental native JAWB v2 bone and world-track reader.
const align = (n, a) => Math.ceil(n / a) * a;
const check = (ok, message) => { if (!ok) throw Error(message); };
export function readNativeJba(b) {
  check(b.length >= 88 && b.toString('ascii', 0, 4) === 'JAWB' && b.readUInt32LE(4) === 2, 'Unsupported JBA signature/version');
  const duration = b.readFloatLE(16), fps = b.readFloatLE(20), count = b.readUInt32LE(24), tracks = b.readUInt32LE(48);
  check(Number.isFinite(duration) && duration >= 0 && fps > 0 && fps <= 120 && count > 0 && count < 4096 && tracks > 0 && tracks < 4096, 'Invalid header limits');
  const frames = Math.round(duration * fps) + 1;
  check(frames * tracks < 2000000, 'Animation exceeds experimental allocation limit');
  const blocks = Array.from({length: count}, (_, i) => ({start: b.readUInt32LE(80 + i * 8), legacySize: b.readUInt32LE(84 + i * 8)}));
  check(blocks[0].start === 0 && blocks.every((v,i)=>v.start < frames && (!i || v.start > blocks[i-1].start)), 'Invalid block frame ranges');
  // Alignment relative to the eight-byte JAWB wrapper.
  let pos = 8 + align(80 + count * 16 - 8, 128);
  const parameters = Array.from({length: tracks}, (_, track) => Array.from({length: 12}, (_, j) => b.readFloatLE(pos + track * 48 + j * 4)));
  check(parameters.flat().every(Number.isFinite), 'Non-finite compression parameters');
  pos = 8 + align(pos + tracks * 48 - 8, 128);
  const motion = parameters.map(() => ({rotations: Array(frames), translations: Array(frames)}));
  let seamMax = 0;
  for (let blockIndex = 0; blockIndex < count; blockIndex++) {
    const block = blocks[blockIndex];
    const samples = blockIndex + 1 < count ? blocks[blockIndex + 1].start - block.start + 1 : frames - block.start;
    // Blocks align to 128 bytes relative to the eight-byte JAWB wrapper.
    // Validate the complete descriptor table at that exact boundary.
    const candidates = [];
    const alignedBlock = 8 + align(pos - 8, 128);
    for (let candidate = alignedBlock; candidate === alignedBlock && candidate <= b.length - 16 - tracks * 32; candidate += 4) {
      if (b.readUInt32LE(candidate) !== tracks || b.readUInt32LE(candidate + 4) !== 0) continue;
      let valid = true;
      for (let t = 0; t < tracks; t++) {
        const p = candidate + 16 + t * 32;
        const r = b.readUInt32LE(p), tr = b.readUInt32LE(p + 16);
        if (r !== samples || (tr !== 0 && tr !== samples) || b.readUInt32LE(p+4) || b.readUInt32LE(p+8) || b.readUInt32LE(p+12) || b.readUInt32LE(p+20) || b.readUInt32LE(p+24) || b.readUInt32LE(p+28)) {valid = false; break;}
      }
      if (valid) candidates.push(candidate);
    }
    check(candidates.length === 1, `Block ${blockIndex}: expected one valid table near ${pos}, found ${candidates.length}`);
    block.physicalStart = candidates[0];
    block.gapBytes = block.physicalStart - pos;
    check(b.subarray(pos, block.physicalStart).every(v => v === 0), 'Nonzero unparsed block gap');
    pos = block.physicalStart + 16 + tracks * 32;
    for (let t = 0; t < tracks; t++) {
      const p = parameters[t];
      const tr = b.readUInt32LE(block.physicalStart + 16 + t * 32 + 16);
      for (let k = 0; k < samples; k++) {
        const rawX = b.readUInt16LE(pos), rawY = b.readUInt16LE(pos+2), rawZ = b.readUInt16LE(pos+4); pos += 6;
        const x = p[9] + (rawX & 32767) * p[6], y = p[10] + rawY * p[7], z = p[11] + rawZ * p[8];
        const w = Math.sqrt(Math.max(0, 1-x*x-y*y-z*z)) * ((rawX & 32768) ? -1 : 1);
        const q = [w,x,y,z], norm = Math.hypot(...q);
        check(Number.isFinite(norm) && norm > 0, 'Invalid quaternion');
        motion[t].rotations[block.start+k] = q.map(v=>v/norm);
      }
      pos = align(pos,4);
      for (let k=0; k<samples; k++) {
        const packed = tr ? b.readUInt32LE(pos) : 0xffffffff;
        if (tr) pos += 4;
        const v = [p[3]+(packed>>>21)*p[0],p[4]+((packed>>>10)&2047)*p[1],p[5]+(packed&1023)*p[2]];
        check(v.every(Number.isFinite), 'Non-finite translation');
        const old = motion[t].translations[block.start+k];
        if (old) seamMax = Math.max(seamMax, Math.hypot(...v.map((x,i)=>x-old[i])));
        motion[t].translations[block.start+k] = v;
      }
    }
    block.consumedEnd = pos;
  }
  check(motion.every(t => Array.from({length:frames},(_,i)=>t.rotations[i] && t.translations[i]).every(Boolean)), 'Missing decoded frames');
  const worldStart=8+align(pos-8,128);
  check(b.subarray(pos,worldStart).every(v=>v===0),'Nonzero padding before world track');
  check(worldStart+96<=b.length,'Truncated world header');
  const worldFps=b.readFloatLE(worldStart+8), nr=b.readUInt32LE(worldStart+64), nt=b.readUInt32LE(worldStart+80);
  check(worldFps===fps && nr===frames && nt===frames,'Unsupported world track counts');
  const p=Array.from({length:12},(_,i)=>b.readFloatLE(worldStart+12+i*4));
  check(p.every(Number.isFinite),'Invalid world compression parameters');
  pos=worldStart+96;
  const rotations=Array.from({length:nr},()=>{
    const raw=b.readUInt16LE(pos),x=p[9]+(raw&32767)*p[6],y=p[10]+b.readUInt16LE(pos+2)*p[7],z=p[11]+b.readUInt16LE(pos+4)*p[8];pos+=6;
    const q=[Math.sqrt(Math.max(0,1-x*x-y*y-z*z))*((raw&32768)?-1:1),x,y,z],n=Math.hypot(...q);
    check(Number.isFinite(n)&&n>0,'Invalid world quaternion');return q.map(v=>v/n);
  });
  pos=align(pos,4);
  const translations=Array.from({length:nt},()=>{const v=b.readUInt32LE(pos);pos+=4;return [p[3]+(v>>>21)*p[0],p[4]+((v>>>10)&2047)*p[1],p[5]+(v&1023)*p[2]];});
  return {format:'JAWB-v2-experimental',duration,fps,frames,tracks,blocks,seamMax,remainingBytes:b.length-pos,worldTrackDecoded:true,world:{physicalStart:worldStart,rotations,translations},motion};
}

// Diagnostic for the supplied ONE-BLOCK matched clip pair, not a general JBA decoder.
import fs from 'node:fs';
import crypto from 'node:crypto';
const legacyPath = 'G:/Old Republic Assets/SWTOR Extracts-Main/AttonRand/cb_pistol_normal_to_combat.jba';
const nativePath = 'G:/Old Republic Assets/resources/anim/humanoid/bmnnew/cb_pistol_normal_to_combat.jba';
const a = fs.readFileSync(legacyPath), b = fs.readFileSync(nativePath);
const assert = (value, message) => { if (!value) throw Error(message); };
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
assert(a.readUInt32LE(0) === 0 && b.toString('ascii', 0, 4) === 'JAWB', 'Unexpected signatures');
assert(b.readUInt32LE(4) === 2, 'Unexpected native version');
const header = (data, modern) => ({ seconds: data.readFloatLE(modern ? 16 : 4), fps: data.readFloatLE(modern ? 20 : 8), blocks: data.readUInt32LE(modern ? 24 : 12), tracks: data.readUInt32LE(modern ? 48 : 24) });
const ah = header(a, false), bh = header(b, true);
assert(JSON.stringify(ah) === JSON.stringify(bh), 'Header properties differ');
assert(ah.blocks === 1 && ah.tracks === 102, 'This diagnostic is restricted to the supplied pair');
const frames = Math.round(ah.seconds * ah.fps) + 1;
assert(frames === 9, 'Unexpected frame count');
// Offsets established through binary comparison of this exact pair.
const boneParametersEqual = a.subarray(128, 128 + 102 * 48).equals(b.subarray(136, 136 + 102 * 48));
const readStreams = (data, modern) => {
  const block = modern ? 5128 : 5120;
  assert(data.readUInt32LE(block) === ah.tracks, 'Block track count mismatch');
  const table = block + (modern ? 16 : 8), stride = modern ? 32 : 16;
  let pos = table + ah.tracks * stride;
  const streams = [];
  for (let track = 0; track < ah.tracks; track++) {
    const rotations = data.readUInt32LE(table + track * stride);
    const translations = data.readUInt32LE(table + track * stride + (modern ? 16 : 8));
    assert(rotations === frames && [0, frames].includes(translations), 'Unexpected key count');
    const rotationBytes = data.subarray(pos, pos + frames * 6); pos += frames * 6;
    pos = (pos + 3) & ~3;
    const translationBytes = data.subarray(pos, pos + translations * 4); pos += translations * 4;
    assert(rotationBytes.length === frames * 6 && translationBytes.length === translations * 4, 'Truncated keys');
    streams.push({ rotations, translations, rotationBytes, translationBytes });
  }
  return { streams, consumedEnd: pos };
};
const oldKeys = readStreams(a, false), newKeys = readStreams(b, true);
const matchingTracks = oldKeys.streams.filter((track, i) => track.rotations === newKeys.streams[i].rotations && track.translations === newKeys.streams[i].translations && track.rotationBytes.equals(newKeys.streams[i].rotationBytes) && track.translationBytes.equals(newKeys.streams[i].translationBytes)).length;
const namesStart = 14756;
assert(a.readUInt32LE(namesStart) === 102, 'Unexpected legacy names table');
const offsets = namesStart + a.readUInt32LE(namesStart + 12);
const strings = namesStart + a.readUInt32LE(namesStart + 16);
const names = Array.from({ length: 102 }, (_, i) => {
  const start = strings + a.readUInt32LE(offsets + i * 4);
  const end = a.indexOf(0, start); assert(end >= start, 'Unterminated bone name');
  return a.toString('utf8', start, end);
});
const report = { scope: 'Exact supplied one-block pair only; offsets are experimentally established, not generalized. No playback claim.',
  legacy: { path: legacyPath, bytes: a.length, sha256: sha(a), ...ah },
  native: { path: nativePath, bytes: b.length, sha256: sha(b), magic: 'JAWB', version: 2, ...bh },
  frames, boneParametersEqual, matchingTracks, totalTracks: ah.tracks,
  oldPayloadEnd: oldKeys.consumedEnd, nativePayloadEnd: newKeys.consumedEnd,
  legacyTrackNames: names, nativeContainsLegacyNames: names.filter(n => b.includes(Buffer.from(n + '\0'))),
  remaining: ['Derive layout/offsets for arbitrary blocks and versions', 'Resolve native track identities without depending on a legacy counterpart', 'Decode and apply local transforms against skeleton rest poses', 'Validate world/root tracks, timing, additive animation and translated bones', 'Visually validate complete rigged character playback'] };
fs.writeFileSync('reports/jba-pair.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ boneParametersEqual, matchingTracks, frames, legacyNames: names.length, nativeNamesFound: report.nativeContainsLegacyNames.length }));
assert(boneParametersEqual && matchingTracks === ah.tracks, 'Pair differs');

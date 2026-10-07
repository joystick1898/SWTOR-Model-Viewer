import fs from 'node:fs';
import path from 'node:path';
const fixture = 'G:/Old Republic Assets/SWTOR Extracts-Main/AttonRand';
const resources = 'G:/Old Republic Assets/resources';
const read = name => JSON.parse(fs.readFileSync(path.join(fixture, 'assets', name), 'utf8'));
const preset = read('preset.json'), paths = read('paths.json'), corrected = read('paths_corrected.json');
const collect = (value, values = new Set()) => {
  if (typeof value === 'string' && /^\/?art\//.test(value)) values.add(value);
  else if (Array.isArray(value)) value.forEach(item => collect(item, values));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => collect(item, values));
  return values;
};
const refs = [...collect(corrected)];
const report = { fixture, skeleton: read('skeleton.json'), slots: corrected.map(slot => ({ slot: slot.slotName, models: slot.models, family: slot.materialInfo?.otherValues?.derived })), equipment: Object.entries(preset).filter(([key, val]) => key.endsWith('Gear') && val).map(([key, val]) => ({ slot: key, name: val.name, ippPath: val.ippPath })), originalReferences: collect(paths).size, correctedReferences: refs.length, missingFromResources: refs.filter(p => !fs.existsSync(path.join(resources, p.replace(/^\//, '')))), changedReferences: { removed: [...collect(paths)].filter(p => !refs.includes(p)), added: refs.filter(p => !collect(paths).has(p)) } };
fs.writeFileSync('reports/atton-fixture.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

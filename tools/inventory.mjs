import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'G:/Old Republic Assets/resources');
const destination = path.resolve(process.argv[3] || 'reports/asset-inventory.json');
if (destination.toLowerCase().startsWith(root.toLowerCase() + path.sep)) throw new Error('Write reports outside source assets');
const report = { root, generatedAt: new Date().toISOString(), version: await fs.readFile(path.join(root, 'version.txt'), 'utf8'), files: 0, extensions: {}, groups: {}, samples: {}, errors: [] };
const stack = [root];
while (stack.length) {
  const directory = stack.pop();
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch (error) { report.errors.push({ directory, error: String(error) }); continue; }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) { stack.push(full); continue; }
    if (!entry.isFile()) continue;
    const relative = path.relative(root, full).replaceAll('\\', '/');
    const extension = path.extname(entry.name).toLowerCase() || '(none)';
    const group = relative.split('/').slice(0, relative.startsWith('art/dynamic/') ? 3 : 2).join('/');
    report.files++;
    report.extensions[extension] = (report.extensions[extension] || 0) + 1;
    report.groups[group] = (report.groups[group] || 0) + 1;
    const key = `${group}:${extension}`;
    const sample = report.samples[key] ||= [];
    if (sample.length < 5) sample.push(relative);
  }
}
await fs.mkdir(path.dirname(destination), { recursive: true });
await fs.writeFile(destination, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ report: destination, files: report.files, extensions: report.extensions, errors: report.errors }, null, 2));

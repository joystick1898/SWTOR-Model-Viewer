import fs from 'node:fs/promises';
import {touchConversion} from './cache-policy.mjs';

// A worker can leave the model behind before writing its completion report.
// Exports also depend on their companion textures, not just the FBX itself.
export async function readCachedConversion(reportPath, expectedFile) {
  try {
    const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    if (typeof report.file !== 'string' || (expectedFile && report.file !== expectedFile) || !Array.isArray(report.textureFiles)) return null;
    const files = [...new Set([report.file, ...report.textureFiles])];
    const stats = await Promise.all(files.map(file => fs.stat(file)));
    if(!stats.every(stat => stat.isFile() && stat.size > 0))return null;
    await touchConversion(report);
    return report;
  } catch {
    return null;
  }
}

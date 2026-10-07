import fs from 'node:fs/promises';

// A worker can leave the model behind before writing its completion report.
// Exports also depend on their companion textures, not just the FBX itself.
export async function readCachedConversion(reportPath, expectedFile) {
  try {
    const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    if (typeof report.file !== 'string' || (expectedFile && report.file !== expectedFile) || !Array.isArray(report.textureFiles)) return null;
    const files = [...new Set([report.file, ...report.textureFiles])];
    const stats = await Promise.all(files.map(file => fs.stat(file)));
    return stats.every(stat => stat.isFile() && stat.size > 0) ? report : null;
  } catch {
    return null;
  }
}

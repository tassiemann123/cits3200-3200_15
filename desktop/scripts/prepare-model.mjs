import { access, copyFile, mkdir } from 'node:fs/promises';
const source = new URL('../../mobile/public/models/skeleton_pre-cut.glb', import.meta.url);
const destination = new URL('../public/models/skeleton_pre-cut.glb', import.meta.url);
try {
  await access(source);
  await mkdir(new URL('../public/models/', import.meta.url), { recursive: true });
  await copyFile(source, destination);
} catch {
  try { await access(destination); }
  catch { throw new Error('Missing mobile model: add skeleton_pre-cut.glb to mobile/public/models/ or desktop/public/models/.'); }
}

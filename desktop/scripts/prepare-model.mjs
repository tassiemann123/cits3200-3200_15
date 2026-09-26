import { access, copyFile, mkdir } from 'node:fs/promises';
const source = new URL('../../mobile/public/models/skeleton_pre-cut.glb', import.meta.url);
const destination = new URL('../public/models/skeleton_pre-cut.glb', import.meta.url);

const exists = async (url) => access(url).then(() => true, () => false);

if (await exists(source)) {
  await mkdir(new URL('../public/models/', import.meta.url), { recursive: true });
  await copyFile(source, destination);
} else if (!(await exists(destination))) {
  console.warn('Optional skeleton_pre-cut.glb is missing. The desktop app will build, but the anatomical 3D model will not appear. Add it to mobile/public/models/ or desktop/public/models/ before a model demo.');
}

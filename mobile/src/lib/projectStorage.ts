/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG,
 * RUAN VAN ZYL
 *
 * File Function:
 * File helpers used by the app: downloadFile (browser download) and
 * safeFilename (strips characters that are invalid in file names).
 * makeProject, saveProject and loadProject are LEGACY -- they store the
 * earlier prototype's project format and the app no longer calls them;
 * the live workspace is saved by App.tsx.
 */

import type { ProjectData, SkeletonLayer } from "../types";

const STORAGE_KEY = "osteoplot.current-project.v1";

export function makeProject(name: string, layers: SkeletonLayer[]): ProjectData {
  const now = new Date().toISOString();
  return { version: 1, name, createdAt: now, updatedAt: now, layers };
}

export function saveProject(project: ProjectData): ProjectData {
  const updated = { ...project, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function loadProject(): ProjectData | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProjectData;
    return parsed.version === 1 && Array.isArray(parsed.layers) ? parsed : null;
  } catch {
    return null;
  }
}

export function downloadFile(contents: BlobPart, filename: string, type: string): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function safeFilename(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-").replace(/^-+|-+$/g, "") || "skeletal-coordinate-project";
}

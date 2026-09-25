import { validateProject, type Project } from './model';

const TIMEOUT_MS = 7_000;

export interface RemoteWorkspaceSummary {
  workspace_id: string;
  name: string;
  revision: number;
  updated_at: string;
}

export interface RemoteWorkspace extends RemoteWorkspaceSummary {
  project: Project;
}

export class BackendApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'BackendApiError';
  }
}

export function backendBaseUrl(): string {
  return (import.meta.env.VITE_API_URL?.trim() || 'http://127.0.0.1:8000').replace(/\/+$/, '');
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${backendBaseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) {
      let message = `Backend request failed (${response.status})`;
      try {
        const body = await response.json() as { detail?: unknown };
        if (typeof body.detail === 'string') message = body.detail;
      } catch { /* Keep the status message for non-JSON responses. */ }
      throw new BackendApiError(message, response.status);
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof BackendApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new BackendApiError('Backend connection timed out');
    }
    throw new BackendApiError(error instanceof Error ? error.message : 'Backend is unavailable');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function listRemoteWorkspaces(): Promise<RemoteWorkspaceSummary[]> {
  return request<RemoteWorkspaceSummary[]>('/desktop/workspaces/');
}

export async function loadRemoteWorkspace(id: string): Promise<RemoteWorkspace> {
  const remote = await request<RemoteWorkspace>(`/desktop/workspaces/${encodeURIComponent(id)}`);
  return { ...remote, project: validateProject(remote.project) };
}

export async function saveRemoteWorkspace(
  project: Project,
  link?: { workspaceId: string; revision: number } | null,
): Promise<RemoteWorkspace> {
  const remote = link
    ? await request<RemoteWorkspace>(`/desktop/workspaces/${encodeURIComponent(link.workspaceId)}`, {
        method: 'PUT',
        body: JSON.stringify({ project, expected_revision: link.revision }),
      })
    : await request<RemoteWorkspace>('/desktop/workspaces/', {
        method: 'POST',
        body: JSON.stringify({ project }),
      });
  return { ...remote, project: validateProject(remote.project) };
}

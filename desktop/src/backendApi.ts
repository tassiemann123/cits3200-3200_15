/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG,
 * RUAN VAN ZYL
 *
 * File Function:
 * Client for the FastAPI backend. Lists, loads and saves desktop workspaces.
 * Every request times out after 7 seconds, failures are raised as BackendApiError
 * (with the HTTP status when there is one), and loaded projects are passed through
 * validateProject so a bad response cannot corrupt local state. Saves send the
 * last known revision so the backend can reject conflicting updates.
 */

import { validateProject, type Project } from './model';

/** Milliseconds before a backend request is aborted. */
const TIMEOUT_MS = 7_000;

/** Backend workspace entry as shown in the open list. */
export interface RemoteWorkspaceSummary {
  workspace_id: string;
  name: string;
  revision: number;
  updated_at: string;
}

/** A full backend workspace including its project. */
export interface RemoteWorkspace extends RemoteWorkspaceSummary {
  project: Project;
}

/** Error from a backend call. `status` is the HTTP status, absent for network failures and timeouts. */
export class BackendApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'BackendApiError';
  }
}

/** Backend address from VITE_API_URL, defaulting to http://127.0.0.1:8000, without trailing slashes. */
export function backendBaseUrl(): string {
  return (import.meta.env.VITE_API_URL?.trim() || 'http://127.0.0.1:8000').replace(/\/+$/, '');
}

/** Sends a JSON request to the backend with a timeout and returns the parsed body. */
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

/** Gets the summaries of all workspaces on the backend. */
export async function listRemoteWorkspaces(): Promise<RemoteWorkspaceSummary[]> {
  return request<RemoteWorkspaceSummary[]>('/desktop/workspaces/');
}

/** Gets one workspace by id and validates its project. */
export async function loadRemoteWorkspace(id: string): Promise<RemoteWorkspace> {
  const remote = await request<RemoteWorkspace>(`/desktop/workspaces/${encodeURIComponent(id)}`);
  return { ...remote, project: validateProject(remote.project) };
}

/** Creates a workspace, or updates the linked one using its last known revision. */
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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackendApiError, loadRemoteWorkspace, saveRemoteWorkspace } from './backendApi';
import { createDemoProject } from './model';

afterEach(() => vi.unstubAllGlobals());

describe('desktop backend API', () => {
  it('sends a complete project and keeps both bone endpoints and inventory', async () => {
    const project = createDemoProject();
    project.individuals[0].joints.find(joint => joint.id === 'left_knee')!.linked = false;
    project.individuals[0].joints.find(joint => joint.id === 'left_knee')!.endpoints[1].coordinate = [4, 5, 6];
    project.individuals[0].bones.find(bone => bone.id === 'left_femur')!.status = 'absent';
    const response = { workspace_id: 'f8e27928-c5d3-4414-974e-103712ec9b83', name: project.name, revision: 1, updated_at: project.updatedAt, project };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await saveRemoteWorkspace(project);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/desktop/workspaces/');
    expect(init.method).toBe('POST');
    const sent = JSON.parse(init.body as string).project;
    expect(sent.individuals[0].joints.find((joint: { id: string }) => joint.id === 'left_knee').endpoints[1].coordinate).toEqual([4, 5, 6]);
    expect(sent.individuals[0].bones.find((bone: { id: string }) => bone.id === 'left_femur').status).toBe('absent');
  });

  it('uses the saved revision and rejects a concurrent remote update', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Workspace changed elsewhere' }), { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);
    const project = createDemoProject();
    const link = { workspaceId: 'f8e27928-c5d3-4414-974e-103712ec9b83', revision: 3 };

    await expect(saveRemoteWorkspace(project, link)).rejects.toMatchObject({ status: 409 } satisfies Partial<BackendApiError>);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/desktop/workspaces/${link.workspaceId}`);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string).expected_revision).toBe(3);
  });

  it('validates a workspace received from the backend before opening it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      workspace_id: 'f8e27928-c5d3-4414-974e-103712ec9b83',
      name: 'Invalid', revision: 1, updated_at: '2026-09-25T00:00:00Z', project: { version: 1 },
    })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadRemoteWorkspace('f8e27928-c5d3-4414-974e-103712ec9b83')).rejects.toThrow();
  });
});

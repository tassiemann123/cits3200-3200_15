import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, FileJson, Plus, Table2, Trash2, X } from 'lucide-react';
import {
  createBlankProject,
  createDemoProject,
  updateCoordinate,
  setBoneStatus,
  validateProject,
} from './model';
import type { Individual, Project, BoneStatus } from './model';
import Header from './components/Header';
import SkeletonSidebar from './components/SkeletonSidebar';
import SceneViewport from './components/SceneViewport';
import SceneControls from './components/SceneControls';
import PopupModal from './components/PopupModal';
import { registerOffline } from './offline';
import { paletteColor } from './lib/colors';
import { BackendApiError, listRemoteWorkspaces, loadRemoteWorkspace, saveRemoteWorkspace, type RemoteWorkspaceSummary } from './backendApi';

const STORAGE_KEY = 'osteo.desktop.project.v2';
const GRAVEYARD_STORAGE_KEY = 'osteo.desktop.graveyards.v1';
const CURRENT_GRAVEYARD_STORAGE_KEY = 'osteo.desktop.currentGraveyard.v1';
const BACKEND_LINK_KEY = 'osteo.desktop.backendLink.v1';
type BackendLink = { workspaceId: string; revision: number };

function restoreBackendLink(): BackendLink | null {
  try {
    if (!localStorage.getItem(STORAGE_KEY)) return null;
    const raw = localStorage.getItem(BACKEND_LINK_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<BackendLink>;
    return typeof value.workspaceId === 'string' && Number.isInteger(value.revision) && value.revision! > 0
      ? { workspaceId: value.workspaceId, revision: value.revision! }
      : null;
  } catch { return null; }
}

// Restore the previous project, falling back to an old project or a blank one.
function restoreProject(): { project: Project; error: string | null } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
      const raw = JSON.parse(stored);
      const validated = validateProject(raw);

      const graveyards =
        validated.graveyards && validated.graveyards.length > 0
          ? validated.graveyards
          : [{ id: 'GY-001', name: 'Graveyard 1' }];

      const validGraveyardIds = new Set(
        graveyards.map(graveyard => graveyard.id),
      );

      return {
        project: {
          ...validated,
          graveyards,
          individuals: validated.individuals.map(individual => ({
            ...individual,
            graveyardId:
              individual.graveyardId &&
              validGraveyardIds.has(individual.graveyardId)
                ? individual.graveyardId
                : graveyards[0].id,
          })),
        },
        error: null,
      };
    }

    const previous = localStorage.getItem('osteo.desktop.project.v1');

    if (previous) {
      const raw = JSON.parse(previous);
      const old = validateProject(raw);

      if (
        JSON.stringify(old.individuals) !==
        JSON.stringify(createDemoProject().individuals)
      ) {
        const graveyards =
          old.graveyards && old.graveyards.length > 0
            ? old.graveyards
            : [{ id: 'GY-001', name: 'Graveyard 1' }];

        const validGraveyardIds = new Set(
          graveyards.map(graveyard => graveyard.id),
        );

        return {
          project: {
            ...old,
            graveyards,
            individuals: old.individuals.map(individual => ({
              ...individual,
              graveyardId:
                individual.graveyardId &&
                validGraveyardIds.has(individual.graveyardId)
                  ? individual.graveyardId
                  : graveyards[0].id,
            })),
          },
          error: null,
        };
      }
    }

    return {
      project: createBlankProject(),
      error: null,
    };
  } catch {
    return {
      project: createBlankProject(),
      error:
        'The saved workspace could not be read. A blank workspace is open; the original saved data has been left untouched. Export it or import a valid backup before continuing.',
    };
  }
}

// Download a file with the given contents, name, and MIME type.
function download(contents: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  // Main project and UI state.
  const [initial] = useState(restoreProject);
  const [project, setProject] = useState<Project>(() => {
    const graveyards =
      initial.project.graveyards && initial.project.graveyards.length > 0
        ? initial.project.graveyards
        : [{ id: 'GY-001', name: 'Graveyard 1' }];

    const validGraveyardIds = new Set(
      graveyards.map(graveyard => graveyard.id),
    );

    return {
      ...initial.project,
      graveyards,
      individuals: initial.project.individuals.map(individual => ({
        ...individual,
        graveyardId:
          individual.graveyardId &&
          validGraveyardIds.has(individual.graveyardId)
            ? individual.graveyardId
            : graveyards[0].id,
      })),
    };
  });
  const [selectedId, setSelectedId] = useState(initial.project.individuals[0]?.id ?? '');
  const [jointId, setJointId] = useState('left_knee');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'perspective' | 'front' | 'top'>('perspective');
  const [showGrid, setShowGrid] = useState(true);
  const [showMarkers, setShowMarkers] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  const [offlineError, setOfflineError] = useState('');
  const [graveyards, setGraveyards] = useState(() => {
    try {
      const saved = localStorage.getItem(GRAVEYARD_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }

      const ids = [
        ...new Set(
          initial.project.individuals
            .map(individual => individual.graveyardId)
            .filter(Boolean),
        ),
      ];

      return ids.length > 0
        ? ids.map((id, index) => ({
            id,
            name: index === 0
              ? 'Graveyard 1'
              : `Graveyard ${index + 1}`,
          }))
        : [{ id: 'GY-001', name: 'Graveyard 1' }];
    } catch {
      return [{ id: 'GY-001', name: 'Graveyard 1' }];
    }
  });
  
  const [currentGraveyardId, setCurrentGraveyardId] = useState(() => {
    const savedId = localStorage.getItem(
      CURRENT_GRAVEYARD_STORAGE_KEY,
    );

    const availableGraveyards =
      initial.project.graveyards &&
      initial.project.graveyards.length > 0
        ? initial.project.graveyards
        : [{ id: 'GY-001', name: 'Graveyard 1' }];

    return (
      availableGraveyards.find(
        graveyard => graveyard.id === savedId,
      )?.id ?? availableGraveyards[0].id
    );
  });

  const [editGraveyardName, setEditGraveyardName] = useState('');
  const [newGraveyardName, setNewGraveyardName] = useState('');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saving');
  const [backendLink, setBackendLink] = useState<BackendLink | null>(restoreBackendLink);
  const [backendState, setBackendState] = useState<'local' | 'saving' | 'saved' | 'offline' | 'conflict'>('local');
  const [remoteWorkspaces, setRemoteWorkspaces] = useState<RemoteWorkspaceSummary[]>([]);
  const [selectedRemote, setSelectedRemote] = useState<RemoteWorkspaceSummary | null>(null);
  const savingRemote = useRef(false);
  const skipNextDirty = useRef(false);
  const projectRef = useRef(project);
  projectRef.current = project;
  const [storageBlocked, setStorageBlocked] = useState(Boolean(initial.error));
  const [toast, setToast] = useState(initial.error ?? '');
  const [modal, setModal] = useState<'export' | 'add' | 'import' | 'delete' | 'delete-graveyard' | 'new-graveyard' | 'edit-graveyard' | 'remote-list' | 'remote-confirm' | null>(null);
  const [deleteSkeletonId, setDeleteSkeletonId] = useState<string | null>(null);
  const [deleteGraveyardId, setDeleteGraveyardId] = useState<string | null>(null);
  const [pendingProject, setPendingProject] = useState<Project | null>(null);
  const [newName, setNewName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const currentIndividuals = project.individuals.filter(
    individual => individual.graveyardId === currentGraveyardId,
  );

  const selected =
    currentIndividuals.find(individual => individual.id === selectedId) ??
    currentIndividuals[0];

  const joint =
    selected?.joints.find(currentJoint => currentJoint.id === jointId) ??
    selected?.joints[0];

  const visibleCount = currentIndividuals.filter(individual => individual.visible).length;
  const notify = (message: string) => setToast(message);

  const updateBackendLink = (link: BackendLink | null) => {
    setBackendLink(link);
    try {
      if (link) localStorage.setItem(BACKEND_LINK_KEY, JSON.stringify(link));
      else localStorage.removeItem(BACKEND_LINK_KEY);
    } catch { notify('Backend link could not be saved on this device.'); }
  };

  const saveWorkspace = async () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      setSaveState('saved');
    } catch {
      setSaveState('error');
      notify('Local saving failed. Export a workspace backup before closing the app.');
      return;
    }
    if (savingRemote.current) return;
    if (!navigator.onLine) {
      setBackendState('offline');
      notify('Saved on this device. Connect to the backend and press Save again to sync.');
      return;
    }
    savingRemote.current = true;
    setBackendState('saving');
    const snapshot = project;
    try {
      const remote = await saveRemoteWorkspace(snapshot, backendLink);
      updateBackendLink({ workspaceId: remote.workspace_id, revision: remote.revision });
      setBackendState(projectRef.current === snapshot ? 'saved' : 'local');
      notify('Desktop workspace saved to the backend.');
    } catch (error) {
      if (error instanceof BackendApiError && error.status === 404) {
        updateBackendLink(null);
        notify('The linked backend workspace was removed. Press Save again to create a new desktop workspace.');
      } else if (error instanceof BackendApiError && error.status === 409) {
        setBackendState('conflict');
        notify('Backend workspace changed elsewhere. Export your local work, then open the backend copy to compare.');
      } else {
        setBackendState('offline');
        notify(`Saved locally; backend sync failed: ${error instanceof Error ? error.message : 'backend unavailable'}`);
      }
    } finally {
      savingRemote.current = false;
    }
  };

  const openBackendList = async () => {
    try {
      const workspaces = await listRemoteWorkspaces();
      setRemoteWorkspaces(workspaces);
      setModal('remote-list');
    } catch (error) {
      notify(`Could not reach the backend: ${error instanceof Error ? error.message : 'backend unavailable'}`);
    }
  };

  const openRemoteWorkspace = async () => {
    if (!selectedRemote) return;
    try {
      const remote = await loadRemoteWorkspace(selectedRemote.workspace_id);
      const next = remote.project;
      const nextGraveyards = next.graveyards?.length ? next.graveyards : [{ id: 'GY-001', name: 'Graveyard 1' }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      skipNextDirty.current = true;
      setProject(next);
      setGraveyards(nextGraveyards);
      setCurrentGraveyardId(nextGraveyards[0].id);
      setSelectedId(next.individuals[0]?.id ?? '');
      setJointId(next.individuals[0]?.joints[0]?.id ?? '');
      updateBackendLink({ workspaceId: remote.workspace_id, revision: remote.revision });
      setStorageBlocked(false);
      setBackendState('saved');
      setSelectedRemote(null);
      setModal(null);
      setFrameKey(value => value + 1);
      notify('Desktop workspace loaded from the backend and saved locally.');
    } catch (error) {
      notify(`Could not open workspace: ${error instanceof Error ? error.message : 'backend unavailable'}`);
    }
  };

  // Update one property of the currently selected skeleton.
  const changeIndividual = (fn: (individual: Individual) => Individual) => {
    if (!selected) return;

    setProject(previous => ({
      ...previous,
      updatedAt: new Date().toISOString(),
      individuals: previous.individuals.map(individual =>
        individual.id === selected.id ? fn(individual) : individual,
      ),
    }));
  };

  // Save project changes to localStorage and keep a final copy when the page closes.
  useEffect(() => {
    if (storageBlocked) {
      setSaveState('error');
      return;
    }

    setSaveState('saving');

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
        setSaveState('saved');
      } catch {
        setSaveState('error');
        notify('Local saving failed. Export your workspace to keep a backup.');
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [project, storageBlocked]);

  useEffect(() => {
    if (skipNextDirty.current) {
      skipNextDirty.current = false;
      return;
    }
    setBackendState(previous => previous === 'conflict' ? previous : 'local');
  }, [project]);

  useEffect(() => {
    const flush = () => {
      if (storageBlocked) return;

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      } catch {
        // Visible save status reports failure.
      }
    };

    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [project, storageBlocked]);

  // Save graveyard state locally for offline use.
  useEffect(() => {
    try {
      localStorage.setItem(GRAVEYARD_STORAGE_KEY, JSON.stringify(graveyards));
    } catch {
      notify('Local graveyard saving failed.');
    }
  }, [graveyards]);

  useEffect(() => {
    try {
      localStorage.setItem(CURRENT_GRAVEYARD_STORAGE_KEY, currentGraveyardId);
    } catch {
      notify('Local graveyard selection could not be saved.');
    }
  }, [currentGraveyardId]);

  // Keep the selected graveyard valid after loading saved state.
  useEffect(() => {
    if (!graveyards.some(graveyard => graveyard.id === currentGraveyardId)) {
      const fallback = graveyards[0]?.id ?? 'GY-001';
      setCurrentGraveyardId(fallback);
    }
  }, [graveyards, currentGraveyardId]);

  // Keep the selected skeleton inside the current graveyard.
  useEffect(() => {
    if (!currentIndividuals.some(individual => individual.id === selectedId)) {
      setSelectedId(currentIndividuals[0]?.id ?? '');
      setJointId(currentIndividuals[0]?.joints[0]?.id ?? '');
    }
  }, [currentGraveyardId, project.individuals]);

  // Track the connection and register the app for offline use.
  useEffect(() => {
    const updateOnlineStatus = () => setOnline(navigator.onLine);

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    const cleanOffline = registerOffline(
      () => {
        setOfflineReady(true);
        setOfflineError('');
      },
      message => {
        setOfflineError(message);
        notify(message);
      },
    );

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      cleanOffline();
    };
  }, []);

  // Automatically hide temporary notifications after a few seconds.
  useEffect(() => {
    if (!toast || storageBlocked) return;

    const id = setTimeout(() => setToast(''), 6500);
    return () => clearTimeout(id);
  }, [toast, storageBlocked]);

  // Close open dialogs when Escape is pressed.
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModal(null);
        setDeleteSkeletonId(null);
      }
    };

    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, []);

  // Import and export project files.
  const importFile = async (file: File) => {
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Please choose a workspace smaller than 5 MB.');
      }

      const next = validateProject(JSON.parse(await file.text()));
      setPendingProject(next);
      setModal('import');
    } catch (error) {
      notify(
        `Import failed: ${
          error instanceof Error ? error.message : 'Invalid workspace file.'
        }`,
      );
    }
  };

  const exportJson = () => {
    download(
      JSON.stringify(project, null, 2),
      `osteo-workspace-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json',
    );

    setModal(null);
    notify('Workspace exported. Both coordinate sets and bone inventory are included.');
  };

  const exportCsv = () => {
    const cell = (value: unknown) => {
      let valueString = String(value ?? '');

      if (typeof value === 'string' && /^[=+@\-*\t\r]/.test(valueString)) {
        valueString = `'${valueString}`;
      }

      return `"${valueString.replace(/"/g, '""')}"`;
    };

    const rows: unknown[][] = [
      ['Accession', 'Individual', 'Joint', 'Bone', 'Status', 'X', 'Y', 'Z', 'Coordinates linked'],
    ];

    for (const person of project.individuals) {
      for (const point of person.joints) {
        for (const endpoint of point.endpoints) {
          rows.push([
            person.accession,
            person.name,
            point.label,
            endpoint.label,
            person.bones.find(bone => bone.id === endpoint.boneId)?.status ?? 'unrecorded',
            ...endpoint.coordinate,
            point.linked ? 'yes' : 'no',
          ]);
        }
      }
    }

    download(
      rows.map(row => row.map(cell).join(',')).join('\r\n'),
      'osteo-bone-coordinates.csv',
      'text/csv;charset=utf-8',
    );

    setModal(null);
    notify('Bone-specific coordinate table exported. Use JSON for a restorable workspace.');
  };

  // Add a new blank skeleton to the current graveyard.
  const addIndividual = () => {
    if (!newName.trim()) return;

    if (project.individuals.length >= 100) {
      notify('This prototype supports up to 100 individuals per workspace.');
      return;
    }

    const base = createBlankProject().individuals[0];
    if (!base) return;

    const person: Individual = {
      ...base,
      id: crypto.randomUUID(),
      name: newName.trim(),
      graveyardId: currentGraveyardId,
      color: paletteColor(project.individuals.length),
      visible: true,
      notes: '',
      joints: base.joints.map(j => ({
        ...j,
        linked: j.endpoints.length === 2,
        endpoints: j.endpoints.map(endpoint => ({
          ...endpoint,
          coordinate: [null, null, null],
        })),
      })),
      bones: base.bones.map(bone => ({ ...bone, status: 'present' })),
    };

    setProject(previous => ({
      ...previous,
      updatedAt: new Date().toISOString(),
      individuals: [...previous.individuals, person],
    }));

    setSelectedId(person.id);
    setJointId('left_knee');
    setModal(null);
    setNewName('');
    notify('Blank skeleton added.');
  };

  // Delete the selected skeleton after the user confirms the action.
  const confirmDeleteSkeleton = () => {
    if (!deleteSkeletonId) return;

    const deletedId = deleteSkeletonId;
    const remaining = currentIndividuals.filter(individual => individual.id !== deletedId);

    setProject(previous => ({
      ...previous,
      updatedAt: new Date().toISOString(),
      individuals: previous.individuals.filter(individual => individual.id !== deletedId),
    }));

    if (selectedId === deletedId) {
      setSelectedId(remaining[0]?.id ?? '');
      setJointId(remaining[0]?.joints[0]?.id ?? '');
    }

    setDeleteSkeletonId(null);
    setModal(null);
    notify('Skeleton deleted.');
  };

  // Delete the current graveyard after the user confirms, unless it still has skeletons.
  const confirmDeleteGraveyard = () => {
    if (!deleteGraveyardId) return;

    const hasSkeletons = project.individuals.some(
      individual => individual.graveyardId === deleteGraveyardId,
    );

    if (hasSkeletons) {
      notify('Graveyards containing skeletons cannot be deleted.');
      setDeleteGraveyardId(null);
      setModal('edit-graveyard');
      return;
    }

    const remainingGraveyards = graveyards.filter(
      graveyard => graveyard.id !== deleteGraveyardId,
    );

    setGraveyards(remainingGraveyards);

    setProject(previous => ({
      ...previous,
      updatedAt: new Date().toISOString(),
      graveyards: remainingGraveyards,
    }));

    if (currentGraveyardId === deleteGraveyardId) {
      setCurrentGraveyardId(remainingGraveyards[0]?.id ?? 'GY-001');
    }

    setDeleteGraveyardId(null);
    setModal(null);
    notify('Graveyard deleted.');
  };

  // Main page layout: header, skeleton sidebar, and 3D viewer.
  return (
    <div className="app-shell">
      <Header
        graveyards={graveyards}
        currentGraveyardId={currentGraveyardId}
        onGraveyardChange={id => {
          setCurrentGraveyardId(id);

          try {
            localStorage.setItem(CURRENT_GRAVEYARD_STORAGE_KEY, id);
          } catch {
            // Visible local state remains active even if storage fails.
          }

          const first = project.individuals.find(
            individual => individual.graveyardId === id,
          );

          setSelectedId(first?.id ?? '');
          setJointId(first?.joints[0]?.id ?? '');
        }}
        
        onManageGraveyard={() => {
          setEditGraveyardName(
            graveyards.find(graveyard => graveyard.id === currentGraveyardId)?.name ?? '',
          );
          setModal('edit-graveyard');
        }}
        
        onNewGraveyard={() => {
          setNewGraveyardName('');
          setModal('new-graveyard');
        }}
        
        onSave={() => { void saveWorkspace(); }}
        onOpenBackend={() => { void openBackendList(); }}
        backendState={backendState}
        onExport={() => setModal('export')}
      />

      <main className="app-main">
        <SkeletonSidebar
          individuals={currentIndividuals}
          selectedId={selected?.id ?? ''}
          query={query}
          onQueryChange={setQuery}
          onSelect={id => {
            setSelectedId(id);
            setJointId('left_knee');
          }}
          onToggleVisibility={id =>
            setProject(previous => ({
              ...previous,
              updatedAt: new Date().toISOString(),
              individuals: previous.individuals.map(individual =>
                individual.id === id
                  ? { ...individual, visible: !individual.visible }
                  : individual,
              ),
            }))
          }
          onExport={id => {
            // TODO: Implement skeleton-specific export functionality. For now, just notify the user.
            notify('Skeleton export will be implemented in a future update.');
          }}
          onDelete={id => {
            setDeleteSkeletonId(id);
            setModal('delete');
          }}
          onAdd={() => setModal('add')}
          onImport={() => fileRef.current?.click()}
          onNameChange={name =>
            changeIndividual(individual => ({ ...individual, name }))
          }
          onColorChange={color =>
            changeIndividual(individual => ({ ...individual, color }))
          }
          onCoordinateChange={(selectedJointId, endpointIndex, axis, value) =>
            changeIndividual(individual =>
              updateCoordinate(individual, selectedJointId, endpointIndex, axis, value),
            )
          }
          onBoneStatusChange={(boneId, status) =>
            changeIndividual(individual => setBoneStatus(individual, boneId, status))
          }
        />

        <section className="viewer-panel" aria-label="Skeleton analysis workspace">
          <SceneControls
            individuals={currentIndividuals}
            selectedId={selected?.id ?? ''}
            view={view}
            showGrid={showGrid}
            showMarkers={showMarkers}
            onViewChange={setView}
            onToggleGrid={() => setShowGrid(value => !value)}
            onToggleMarkers={() => setShowMarkers(value => !value)}
            onFit={() => {
              setFrameKey(value => value + 1);
              setZoom(1);
            }}
            onSelect={id => setSelectedId(id)}
          />

          <div className="scene-area">
            <SceneViewport
              individuals={currentIndividuals}
              selectedId={selected?.id ?? ''}
              selectedJointId={joint?.id ?? ''}
              onSelect={(individualId, selectedJointId) => {
                setSelectedId(individualId);
                setJointId(selectedJointId);
              }}
              showGrid={showGrid}
              showMarkers={showMarkers}
              view={view}
              frameKey={frameKey}
              zoom={zoom * 100}
            />

            <div className="scene-corner-label">
              <span className="status-dot" />
              SHARED COORDINATE SPACE
            </div>

            <div className="zoom-control">
              <button
                aria-label="Zoom out"
                onClick={() => setZoom(value => Math.max(0.35, value / 1.2))}
              >
                −
              </button>

              <span>{Math.round(zoom * 100)}%</span>

              <button
                aria-label="Zoom in"
                onClick={() => setZoom(value => Math.min(3, value * 1.2))}
              >
                +
              </button>
            </div>

            {(visibleCount === 0 ||
              !currentIndividuals.some(
                individual =>
                  individual.visible &&
                  individual.joints.some(joint =>
                    joint.endpoints.some(endpoint =>
                      endpoint.coordinate.every(value => value !== null),
                    ),
                  ),
              )) && (
              <div className="scene-empty">
                <strong>
                  {visibleCount === 0 ? 'No visible skeletons' : 'Enter coordinates to start'}
                </strong>

                <span>
                  {visibleCount === 0
                    ? 'Show a skeleton from the sidebar.'
                    : 'Anatomical bone pieces appear as landmarks are recorded.'}
                </span>
              </div>
            )}
          </div>

          <div className="scene-footer">
            <span>
              {showMarkers ? 'Click a marker to inspect' : 'Joint markers are hidden'}
            </span>

            <span>
              Drag to orbit <b>·</b> Right-drag to pan <b>·</b> Scroll to zoom
            </span>
          </div>
        </section>
      </main>

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        aria-label="Import JSON workspace"
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
          event.currentTarget.value = '';
        }}
      />

      {toast && (
        <div className={`toast ${saveState === 'error' ? 'error-toast' : ''}`} role="status">
          <span>{toast}</span>

          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {modal && (
        <PopupModal
          title={
            modal === 'export'
              ? 'Take your work with you.'
              : modal === 'remote-list'
                ? 'Desktop workspaces on the backend'
                : modal === 'remote-confirm'
                  ? 'Open backend workspace?'
              : modal === 'add'
                ? 'Add a skeleton'
                : modal === 'delete'
                  ? 'Delete skeleton?'
                  : modal === 'new-graveyard'
                    ? 'New graveyard'
                    : modal === 'edit-graveyard'
                      ? 'Manage graveyard'
                      : modal === 'delete-graveyard'
                        ? 'Delete graveyard?'
                        : 'Open this workspace?'
          }
          onClose={() => {
            setModal(null);
            setDeleteSkeletonId(null);
          }}
        >
          {modal === 'remote-list' && (
            <>
              <p>Select a desktop workspace. Mobile records are stored separately.</p>
              <div className="remote-workspace-list">
                {remoteWorkspaces.length === 0 && <p>No desktop workspaces have been saved yet.</p>}
                {remoteWorkspaces.map(remote => (
                  <button className="remote-workspace-choice" key={remote.workspace_id} onClick={() => { setSelectedRemote(remote); setModal('remote-confirm'); }}>
                    <strong>{remote.name}</strong>
                    <small>{new Date(remote.updated_at).toLocaleString()}</small>
                  </button>
                ))}
              </div>
            </>
          )}

          {modal === 'remote-confirm' && selectedRemote && (
            <>
              <p>Opening <strong>{selectedRemote.name}</strong> replaces the workspace saved on this device.</p>
              <p className="input-hint">Export your local workspace first if you need to keep it.</p>
              <div className="button-row">
                <button className="button" onClick={() => setModal('remote-list')}>Cancel</button>
                <button className="button primary" onClick={() => { void openRemoteWorkspace(); }}>Open workspace</button>
              </div>
            </>
          )}

          {modal === 'new-graveyard' && (
            <form
              onSubmit={event => {
                event.preventDefault();

                const name = newGraveyardName.trim();
                if (!name) return;

                const graveyard = {
                  id: crypto.randomUUID(),
                  name,
                };

                const updatedGraveyards = [...graveyards, graveyard];

                setGraveyards(updatedGraveyards);

                setProject(previous => ({
                  ...previous,
                  updatedAt: new Date().toISOString(),
                  graveyards: updatedGraveyards,
                }));

                setCurrentGraveyardId(graveyard.id);
                setSelectedId('');
                setJointId('');
                setNewGraveyardName('');
                setModal(null);
                notify(`${name} created.`);
              }}
            >
              <label className="modal-field">
                Graveyard name
                <input
                  autoFocus
                  required
                  maxLength={80}
                  placeholder="e.g. LN24 East"
                  value={newGraveyardName}
                  onChange={event => setNewGraveyardName(event.target.value)}
                />
              </label>

              <button className="button primary wide" type="submit">
                Create graveyard
              </button>
            </form>
          )}

          {modal === 'edit-graveyard' && (
            <>
              <form
                onSubmit={event => {
                  event.preventDefault();

                  const name = editGraveyardName.trim();
                  if (!name) return;

                  const updatedGraveyards = graveyards.map(graveyard =>
                    graveyard.id === currentGraveyardId
                      ? { ...graveyard, name }
                      : graveyard,
                  );

                  setGraveyards(updatedGraveyards);

                  setProject(previous => ({
                    ...previous,
                    updatedAt: new Date().toISOString(),
                    graveyards: updatedGraveyards,
                  }));

                  setModal(null);
                  notify('Graveyard renamed.');
                }}
              >
                <label className="modal-field">
                  Graveyard name
                  <input
                    autoFocus
                    maxLength={80}
                    value={editGraveyardName}
                    onChange={event => setEditGraveyardName(event.target.value)}
                  />
                </label>

                <button className="button primary wide" type="submit">
                  Rename graveyard
                </button>
              </form>

              <button
                className="button danger wide"
                type="button"
                onClick={() => {
                  setDeleteGraveyardId(currentGraveyardId);
                  setModal('delete-graveyard');
                }}
              >
                Delete graveyard
              </button>
            </>
          )}

          {modal === 'delete-graveyard' && (
            <>
              <div className="delete-confirmation">
                <p>
                  Are you sure you want to delete{' '}
                  <strong>
                    {graveyards.find(
                      graveyard => graveyard.id === deleteGraveyardId,
                    )?.name ?? 'this graveyard'}
                  </strong>
                  ?
                </p>

                <p className="input-hint">
                  Graveyards containing skeletons cannot be deleted.
                </p>
              </div>

              <div className="button-row">
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    setModal('edit-graveyard');
                    setDeleteGraveyardId(null);
                  }}
                >
                  Cancel
                </button>

                <button
                  className="button danger"
                  type="button"
                  onClick={confirmDeleteGraveyard}
                >
                  Delete
                </button>
              </div>
            </>
          )}

          {modal === 'export' && (
            <>
              <p>Keep both coordinate sets, bone inventory and notes in a portable backup.</p>

              <button className="export-choice" onClick={exportJson}>
                <FileJson size={26} />

                <div>
                  <strong>Workspace file <span>RECOMMENDED</span></strong>
                  <p>JSON · reopen and continue editing in OSTEO</p>
                </div>

                <ArrowDownToLine size={18} />
              </button>

              <button className="export-choice" onClick={exportCsv}>
                <Table2 size={26} />

                <div>
                  <strong>Coordinate table</strong>
                  <p>CSV · one row per bone-owned endpoint</p>
                </div>

                <ArrowDownToLine size={18} />
              </button>

              <p className="input-hint">
                CSV is for analysis and sharing. Use the workspace file to restore your full project.
              </p>
            </>
          )}

          {modal === 'add' && (
            <form
              onSubmit={event => {
                event.preventDefault();
                addIndividual();
              }}
            >
              <p>Start with empty coordinates. Bones are initially marked present.</p>

              <label className="modal-field">
                Skeleton ID
                <input
                  autoFocus
                  required
                  maxLength={80}
                  placeholder="e.g. IND-003"
                  value={newName}
                  onChange={event => setNewName(event.target.value)}
                />
              </label>

              <button className="button primary wide" type="submit">
                Create skeleton
              </button>
            </form>
          )}

          {modal === 'delete' && (
            <>
              <div className="delete-confirmation">
                <p>
                  Are you sure you want to delete{' '}
                  <strong>
                    {project.individuals.find(individual => individual.id === deleteSkeletonId)?.name ??
                      'this skeleton'}
                  </strong>
                  ?
                </p>

                <p className="input-hint">
                  This action will remove the skeleton from the current workspace.
                </p>
              </div>

              <div className="button-row">
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    setModal(null);
                    setDeleteSkeletonId(null);
                  }}
                >
                  Cancel
                </button>

                <button className="button danger" type="button" onClick={confirmDeleteSkeleton}>
                  Delete
                </button>
              </div>
            </>
          )}

          {modal === 'import' && pendingProject && (
            <>
              <p>
                <strong>{pendingProject.name}</strong> contains {pendingProject.individuals.length}{' '}
                skeletons. Opening it will replace the current workspace saved on this device.
              </p>

              <div className="modal-note">
                Export your current workspace first if you want to keep it.
              </div>

              <div className="button-row">
                <button className="button" onClick={exportJson}>
                  Export current
                </button>

                <button
                  className="button primary"
                  onClick={() => {
                    updateBackendLink(null);
                    setBackendState('local');
                    const importedGraveyards = pendingProject.graveyards?.length
                      ? pendingProject.graveyards
                      : [{ id: 'GY-001', name: 'Graveyard 1' }];
                    setProject({
                      ...pendingProject,
                      graveyards: importedGraveyards,
                      individuals: pendingProject.individuals.map(individual => ({
                        ...individual,
                        graveyardId: individual.graveyardId ?? importedGraveyards[0].id,
                      })),
                    });

                    setGraveyards(importedGraveyards);
                    setCurrentGraveyardId(pendingProject.individuals[0]?.graveyardId ?? importedGraveyards[0].id);
                    setSelectedId(pendingProject.individuals[0]?.id ?? '');
                    setJointId(pendingProject.individuals[0]?.joints[0]?.id ?? '');
                    setStorageBlocked(false);
                    setModal(null);
                    setFrameKey(value => value + 1);
                    notify('Workspace imported and saved on this device.');
                  }}
                >
                  Open workspace
                </button>
              </div>
            </>
          )}
        </PopupModal>
      )}
    </div>
  );
}

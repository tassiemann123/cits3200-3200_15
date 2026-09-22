import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, FileJson, Plus, Table2, X } from 'lucide-react';
import {
  createBlankProject,
  createDemoProject,
  updateCoordinate,
  validateProject,
} from './model';
import type { Individual, Project } from './model';
import Header from './components/Header';
import SkeletonSidebar from './components/SkeletonSidebar';
import SceneViewport from './components/SceneViewport';
import SceneControls from './components/SceneControls';
import PopupModal from './components/PopupModal';
import { registerOffline } from './offline';

const STORAGE_KEY = 'osteo.desktop.project.v2';

// Restore the previous project, falling back to an old project or a blank one.
function restoreProject(): { project: Project; error: string | null } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { project: validateProject(JSON.parse(stored)), error: null };

    const previous = localStorage.getItem('osteo.desktop.project.v1');
    if (previous) {
      const old = validateProject(JSON.parse(previous));
      if (JSON.stringify(old.individuals) !== JSON.stringify(createDemoProject().individuals)) {
        return { project: old, error: null };
      }
    }

    return { project: createBlankProject(), error: null };
  } catch {
    return {
      project: createBlankProject(),
      error: 'The saved workspace could not be read. A demo is open; the original saved data has been left untouched. Export it or import a valid backup before continuing.',
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
  const [project, setProject] = useState(initial.project);
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
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saving');
  const [storageBlocked, setStorageBlocked] = useState(Boolean(initial.error));
  const [toast, setToast] = useState(initial.error ?? '');
  const [modal, setModal] = useState<'export' | 'add' | 'import' | 'delete' | null>(null);
  const [deleteSkeletonId, setDeleteSkeletonId] = useState<string | null>(null);
  const [pendingProject, setPendingProject] = useState<Project | null>(null);
  const [newName, setNewName] = useState('');
  const [newAccession, setNewAccession] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const selected =
    project.individuals.find(individual => individual.id === selectedId) ??
    project.individuals[0];

  const joint =
    selected?.joints.find(currentJoint => currentJoint.id === jointId) ??
    selected?.joints[0];

  const visibleCount = project.individuals.filter(individual => individual.visible).length;
  const notify = (message: string) => setToast(message);

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
    }, 250);

    return () => clearTimeout(timer);
  }, [project, storageBlocked]);

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

  // Add a new blank skeleton to the current project.
  const addIndividual = () => {
    if (!newName.trim() || !newAccession.trim()) return;

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
      accession: newAccession.trim(),
      color: ['#355c7d', '#b08e59', '#7189a4', '#9b788c'][project.individuals.length % 4],
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
    setNewAccession('');
    notify('Blank skeleton added.');
  };

  // Delete the selected skeleton after the user confirms the action.
  const confirmDeleteSkeleton = () => {
    if (!deleteSkeletonId) return;

    const deletedId = deleteSkeletonId;
    const remaining = project.individuals.filter(individual => individual.id !== deletedId);

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

  // Main page layout: header, skeleton sidebar, and 3D viewer.
  return (
    <div className="app-shell">
      <Header
        graveyardName="Graveyard 1"
        onNewGraveyard={() =>
          notify('Graveyard creation will be connected once graveyard data is added to the project model.')
        }
        onExport={() => setModal('export')}
      />

      <main className="app-main">
        <SkeletonSidebar
          individuals={project.individuals}
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
        />

        <section className="viewer-panel" aria-label="Skeleton analysis workspace">
          <SceneControls
            individuals={project.individuals}
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
              individuals={project.individuals}
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
              !project.individuals.some(
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

      {/* Hidden file input used to trigger project imports. */}
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

      {/* Temporary notifications shown to the user. */}
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
              : modal === 'add'
                ? 'Add a skeleton'
                : modal === 'delete'
                  ? 'Delete skeleton?'
                  : 'Open this workspace?'
          }
          onClose={() => {
            setModal(null);
            setDeleteSkeletonId(null);
          }}
        >
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
                Body / skeleton ID
                <input
                  autoFocus
                  required
                  maxLength={80}
                  placeholder="e.g. IND-003"
                  value={newName}
                  onChange={event => setNewName(event.target.value)}
                />
              </label>

              <label className="modal-field">
                Accession number
                <input
                  required
                  maxLength={80}
                  placeholder="e.g. BP002"
                  value={newAccession}
                  onChange={event => setNewAccession(event.target.value)}
                />
              </label>

              <button className="button primary wide" type="submit">
                <Plus size={16} />
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
                    setProject(pendingProject);
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
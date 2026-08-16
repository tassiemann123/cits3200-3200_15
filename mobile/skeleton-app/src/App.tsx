import { useState } from 'react';
import ThreeScene from './components/ThreeScene';
import TopBar from './components/TopBar';
import CoordinatePanel from './components/CoordinatePanel';
import type { Project, Coord } from './types';
import type { PointName } from './data/cfaSchema';

function makeEmptyProject(n: number): Project {
  return { id: crypto.randomUUID(), name: `Skeleton ${n}`, coordinates: {}, excludedGroups: [] };
}

function App() {
  const [projects, setProjects] = useState<Project[]>([makeEmptyProject(1)]);
  const [activeProjectId, setActiveProjectId] = useState(projects[0].id);
  const [panelOpen, setPanelOpen] = useState(false);

  const activeProject = projects.find((p) => p.id === activeProjectId)!;

  function handleNewProject() {
    const newProject = makeEmptyProject(projects.length + 1);
    setProjects((prev) => [...prev, newProject]);
    setActiveProjectId(newProject.id);
  }

  function handleRenameProject(id: string, newName: string) {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: newName } : p))
    );
  }

  function handleChangePoint(point: PointName, coord: Coord) {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId
          ? { ...p, coordinates: { ...p.coordinates, [point]: coord } }
          : p
      )
    );
  }

  function handleResetCoordinates() {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId ? { ...p, coordinates: {} } : p
      )
    );
  }

  function handleToggleGroup(groupLabel: string) {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== activeProjectId) return p;
        const isExcluded = p.excludedGroups.includes(groupLabel);
        return {
          ...p,
          excludedGroups: isExcluded
            ? p.excludedGroups.filter((g) => g !== groupLabel)
            : [...p.excludedGroups, groupLabel],
        };
      })
    );
  }

  // PLACEHOLDER - not implemented yet. Intended to eventually save the
  // current skeleton's data (and/or a screenshot) to local device storage,
  // per the "export" requirement from the Requirements Framework. Needs
  // Capacitor's Filesystem plugin for real on-device file writing - not
  // wired up yet, this just confirms the button/flow exists in the UI.
  function handleExport() {
    alert('Export is not implemented yet. This is a placeholder button.');
  }

  function handleModelLoaded() {
    // Bone map available here once posing logic is ready to be wired in.
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <ThreeScene onModelLoaded={handleModelLoaded} />

      <TopBar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
        onNewProject={handleNewProject}
        onRenameProject={handleRenameProject}
      />

      {/* PLACEHOLDER export button - see handleExport comment above */}
      <button
        onClick={handleExport}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 20,
          background: 'rgba(0,0,0,0.85)',
          color: '#fff',
          border: '1px solid #444',
          borderRadius: 8,
          padding: '10px 14px',
          fontFamily: 'sans-serif',
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        ⬇ Export
      </button>

      <CoordinatePanel
        open={panelOpen}
        onToggle={() => setPanelOpen((o) => !o)}
        coordinates={activeProject.coordinates}
        onChangePoint={handleChangePoint}
        onReset={handleResetCoordinates}
        excludedGroups={activeProject.excludedGroups}
        onToggleGroup={handleToggleGroup}
      />
    </div>
  );
}

export default App;
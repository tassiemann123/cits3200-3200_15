import { useState } from 'react';
import ThreeScene from './components/ThreeScene';
import TopBar from './components/TopBar';
import CoordinatePanel from './components/CoordinatePanel';
import type { Project, Coord } from './types';
import type { PointName } from './data/cfaSchema';

function makeEmptyProject(n: number): Project {
  return { id: crypto.randomUUID(), name: `Skeleton ${n}`, coordinates: {} };
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

      <CoordinatePanel
        open={panelOpen}
        onToggle={() => setPanelOpen((o) => !o)}
        coordinates={activeProject.coordinates}
        onChangePoint={handleChangePoint}
      />
    </div>
  );
}

export default App;
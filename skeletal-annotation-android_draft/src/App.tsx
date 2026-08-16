import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bone,
  Camera,
  Crosshair,
  Database,
  Download,
  FileJson,
  Focus,
  Grid3X3,
  Layers3,
  ListTree,
  Menu,
  PanelRight,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { DetailsPanel } from "./components/DetailsPanel";
import { LayerPanel } from "./components/LayerPanel";
import { ManualEntryDialog, type ManualEntry } from "./components/ManualEntryDialog";
import { SceneViewport, type SceneViewportHandle } from "./components/SceneViewport";
import { paletteColor } from "./lib/colors";
import { surveyToWorld } from "./lib/coordinates";
import { parseCsv } from "./lib/csvParser";
import { downloadFile, loadProject, makeProject, safeFilename, saveProject } from "./lib/projectStorage";
import { parseRot } from "./lib/rotParser";
import type { ProjectData, SkeletonLayer } from "./types";

type MobilePane = "layers" | "scene" | "details";

function isProjectData(value: unknown): value is ProjectData {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<ProjectData>;
  return project.version === 1 && typeof project.name === "string" && Array.isArray(project.layers);
}

export function App() {
  const savedProject = useMemo(() => loadProject(), []);
  const [project, setProject] = useState<ProjectData>(() => savedProject ?? makeProject("LN24 Field Reconstruction", []));
  const [selectedId, setSelectedId] = useState<string | null>(() => savedProject?.layers.find((layer) => !layer.locked)?.id ?? null);
  const [showGrid, setShowGrid] = useState(true);
  const [showModels, setShowModels] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>("scene");
  const [toast, setToast] = useState<string | null>(null);
  const [sampleLoaded, setSampleLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<SceneViewportHandle>(null);

  const selectedLayer = project.layers.find((layer) => layer.id === selectedId) ?? null;
  const bodyLayers = project.layers.filter((layer) => !layer.locked);
  const totalPoints = bodyLayers.reduce((sum, layer) => sum + layer.landmarks.length, 0);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => current === message ? null : current), 2800);
  };

  useEffect(() => {
    if (savedProject || sampleLoaded) return;
    setSampleLoaded(true);
    fetch("/samples/LN24-East-Colour.rot")
      .then((response) => {
        if (!response.ok) throw new Error("Sample unavailable");
        return response.text();
      })
      .then((text) => {
        const result = parseRot(text, "LN24-East-Colour.rot");
        setProject((current) => ({ ...current, layers: result.layers }));
        const firstBody = result.layers.find((layer) => !layer.locked);
        if (firstBody) setSelectedId(firstBody.id);
      })
      .catch(() => notify("The sample data could not be loaded. Use Import Data to select a local file."));
  }, [sampleLoaded, savedProject]);

  const patchLayer = (id: string, patch: Partial<SkeletonLayer>) => {
    setProject((current) => ({ ...current, layers: current.layers.map((layer) => layer.id === id ? { ...layer, ...patch } : layer) }));
  };

  const importFile = async (file: File) => {
    try {
      const text = await file.text();
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (extension === "json") {
        const imported: unknown = JSON.parse(text);
        if (!isProjectData(imported)) throw new Error("This JSON file is not a valid OsteoPlot project." );
        setProject({ ...imported, updatedAt: new Date().toISOString() });
        setSelectedId(imported.layers.find((layer) => !layer.locked)?.id ?? imported.layers[0]?.id ?? null);
        notify(`Project loaded: ${imported.name}`);
        return;
      }
      const result = extension === "rot" ? parseRot(text, file.name) : parseCsv(text, file.name);
      if (result.layers.length === 0) throw new Error(result.warnings[0] ?? "The file contains no usable coordinates." );
      setProject((current) => ({ ...current, layers: [...current.layers, ...result.layers] }));
      setSelectedId(result.layers.find((layer) => !layer.locked)?.id ?? result.layers[0].id);
      notify(`Imported ${result.layers.length} layer${result.layers.length === 1 ? "" : "s"}${result.warnings.length ? ` with ${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}` : ""}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Import failed. Check the file format." );
    }
  };

  const addManualPoint = (entry: ManualEntry) => {
    const position = surveyToWorld(entry.x, entry.z, entry.y);
    const existing = project.layers.find((layer) => layer.name.toLowerCase() === entry.skeletonId.toLowerCase());
    if (existing) {
      patchLayer(existing.id, {
        landmarks: [...existing.landmarks, { id: `${existing.id}-${Date.now()}`, label: entry.pointName, position }],
      });
      setSelectedId(existing.id);
    } else {
      const id = `manual-${entry.skeletonId.toLowerCase().replace(/\W+/g, "-")}-${Date.now()}`;
      const layer: SkeletonLayer = {
        id,
        name: entry.skeletonId,
        sourceName: "Manual entry",
        color: paletteColor(project.layers.length),
        visible: true,
        locked: false,
        modelType: "landmarks",
        segments: [],
        landmarks: [{ id: `${id}-1`, label: entry.pointName, position }],
        notes: "",
      };
      setProject((current) => ({ ...current, layers: [...current.layers, layer] }));
      setSelectedId(id);
    }
    notify(`${entry.skeletonId} · ${entry.pointName} added`);
  };

  const removeLayer = (id: string) => {
    const layer = project.layers.find((item) => item.id === id);
    if (!layer || !window.confirm(`Delete ${layer.name}? This change has not been saved yet.`)) return;
    setProject((current) => ({ ...current, layers: current.layers.filter((item) => item.id !== id) }));
    setSelectedId(project.layers.find((item) => item.id !== id && !item.locked)?.id ?? null);
  };

  const persist = () => {
    setProject((current) => saveProject(current));
    notify("Project saved locally");
  };

  const exportJson = () => {
    const updated = { ...project, updatedAt: new Date().toISOString() };
    downloadFile(JSON.stringify(updated, null, 2), `${safeFilename(project.name)}.json`, "application/json");
    setExportOpen(false);
    notify("Project JSON exported");
  };

  const exportScreenshot = async () => {
    const blob = await viewportRef.current?.capturePng();
    if (!blob) return notify("The screenshot could not be generated." );
    downloadFile(blob, `${safeFilename(project.name)}-viewport.png`, "image/png");
    setExportOpen(false);
    notify("3D viewport screenshot exported");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark"><Bone size={22} /></div>
          <div><strong>OsteoPlot</strong><span>3D SKELETAL ANNOTATION</span></div>
        </div>
        <div className="project-title-block">
          <span className="offline-badge"><ShieldCheck size={14} /> Offline project</span>
          <input
            aria-label="Project name"
            value={project.name}
            onChange={(event) => setProject((current) => ({ ...current, name: event.target.value }))}
          />
        </div>
        <div className="header-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".rot,.csv,.json,text/plain,text/csv,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
              event.target.value = "";
            }}
          />
          <button type="button" className="header-button" onClick={() => setManualOpen(true)}><Plus size={17} /><span>Add Landmark</span></button>
          <button type="button" className="header-button" onClick={() => fileInputRef.current?.click()}><Upload size={17} /><span>Import Data</span></button>
          <button type="button" className="header-button" onClick={persist}><Save size={17} /><span>Save</span></button>
          <div className="export-menu-wrap">
            <button type="button" className="primary-header-button" onClick={() => setExportOpen((open) => !open)}><Download size={17} /><span>Export</span></button>
            {exportOpen && (
              <div className="export-menu">
                <button type="button" onClick={() => void exportScreenshot()}><Camera size={17} /><span><strong>Viewport Screenshot</strong><small>PNG · Current camera angle</small></span></button>
                <button type="button" onClick={exportJson}><FileJson size={17} /><span><strong>Project Data</strong><small>JSON · Reloadable</small></span></button>
              </div>
            )}
          </div>
          <button type="button" className="mobile-menu-button" onClick={() => setMobilePane(mobilePane === "scene" ? "layers" : "scene")}><Menu size={20} /></button>
        </div>
      </header>

      <main className="workspace-grid">
        <div className={`workspace-pane left-pane ${mobilePane === "layers" ? "mobile-active" : ""}`}>
          <LayerPanel
            layers={project.layers}
            selectedId={selectedId}
            onSelect={(id) => { setSelectedId(id); setMobilePane("scene"); }}
            onPatch={patchLayer}
            onShowAll={(visible) => setProject((current) => ({ ...current, layers: current.layers.map((layer) => ({ ...layer, visible })) }))}
          />
        </div>

        <section className={`viewport-section ${mobilePane === "scene" ? "mobile-active" : ""}`}>
          <SceneViewport
            ref={viewportRef}
            layers={project.layers}
            selectedId={selectedId}
            showGrid={showGrid}
            showModels={showModels}
            onSelect={setSelectedId}
          />
          <div className="viewport-topbar">
            <div className="scene-stats">
              <span><Layers3 size={14} /> {bodyLayers.length} individuals</span>
              <span><Crosshair size={14} /> {totalPoints.toLocaleString()} landmarks</span>
            </div>
            <div className="viewport-tools">
              <button type="button" className={showGrid ? "active" : ""} onClick={() => setShowGrid((value) => !value)} title="Coordinate grid"><Grid3X3 size={18} /></button>
              <button type="button" className={showModels ? "active" : ""} onClick={() => setShowModels((value) => !value)} title="Reference models"><Bone size={18} /></button>
              <button type="button" onClick={() => viewportRef.current?.focusSelected()} title="Focus selected"><Focus size={18} /></button>
              <button type="button" onClick={() => viewportRef.current?.resetCamera()} title="Reset camera"><RotateCcw size={18} /></button>
            </div>
          </div>
          <div className="orientation-cube" aria-hidden="true">
            <span className="axis-y">Z↑</span><span className="axis-x">X→</span><span className="axis-z">Y↘</span>
          </div>
          <div className="viewport-caption">
            <span className="pulse-dot" />
            <div><strong>{selectedLayer?.name ?? "No selection"}</strong><small>{selectedLayer ? `${selectedLayer.sourceName} · X/Z/Y survey coordinates` : "Select a skeleton in the viewport"}</small></div>
          </div>
          <div className="touch-hint">Drag to rotate · Pinch or scroll to zoom · Tap to select</div>
        </section>

        <div className={`workspace-pane right-pane ${mobilePane === "details" ? "mobile-active" : ""}`}>
          <DetailsPanel layer={selectedLayer} onPatch={patchLayer} onRemove={removeLayer} />
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button type="button" className={mobilePane === "layers" ? "active" : ""} onClick={() => setMobilePane("layers")}><ListTree size={19} />Layers</button>
        <button type="button" className={mobilePane === "scene" ? "active" : ""} onClick={() => setMobilePane("scene")}><Database size={19} />3D Scene</button>
        <button type="button" className={mobilePane === "details" ? "active" : ""} onClick={() => setMobilePane("details")}><PanelRight size={19} />Details</button>
      </nav>

      <ManualEntryDialog open={manualOpen} onClose={() => setManualOpen(false)} onAdd={addManualPoint} />
      {toast && <div className="toast"><ShieldCheck size={17} />{toast}<button type="button" onClick={() => setToast(null)}><X size={15} /></button></div>}
    </div>
  );
}

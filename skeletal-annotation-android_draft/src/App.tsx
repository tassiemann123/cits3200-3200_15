import { useEffect, useRef, useState } from "react";
import {
  Bone,
  Camera,
  Database,
  Focus,
  Grid3X3,
  PanelRight,
  RotateCcw,
  Save,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { DetailsPanel } from "./components/DetailsPanel";
import { SceneViewport, type SceneViewportHandle } from "./components/SceneViewport";
import { downloadFile, safeFilename } from "./lib/projectStorage";
import type { Landmark, ModelLoadState, ViewerModel } from "./types";

type MobilePane = "scene" | "details";

interface ViewerPreferences {
  projectName: string;
  notes: string;
}

const STORAGE_KEY = "osteoplot.reference-viewer.v1";
const DEFAULT_PREFERENCES: ViewerPreferences = {
  projectName: "Skeletal Model Workspace",
  notes: "",
};

const INITIAL_MODEL: ViewerModel = {
  name: "Skeleton Reference",
  url: "/models/skeleton_pre-cut.glb",
  origin: "bundled",
  subtitle: "Bundled anatomical reference · GLB",
  attribution: "Skeleton Pre-cut · Maxime66410 · Sketchfab Standard",
};

// Replace this empty collection with coordinate points returned by the backend.
const BACKEND_COORDINATES: Landmark[] = [];

function modelNameFromFile(fileName: string): string {
  const name = fileName.replace(/\.glb$/i, "").replace(/[-_]+/g, " ").trim();
  if (!name) return "Imported Model";
  return name.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function loadPreferences(): ViewerPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const saved = JSON.parse(raw) as Partial<ViewerPreferences>;
    return {
      projectName: typeof saved.projectName === "string" ? saved.projectName : DEFAULT_PREFERENCES.projectName,
      notes: typeof saved.notes === "string" ? saved.notes : "",
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function App() {
  const [preferences, setPreferences] = useState<ViewerPreferences>(loadPreferences);
  const [model, setModel] = useState<ViewerModel>(INITIAL_MODEL);
  const [modelLoadState, setModelLoadState] = useState<ModelLoadState>("loading");
  const [showGrid, setShowGrid] = useState(true);
  const [mobilePane, setMobilePane] = useState<MobilePane>("scene");
  const [toast, setToast] = useState<string | null>(null);
  const viewportRef = useRef<SceneViewportHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importedObjectUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (importedObjectUrlRef.current) URL.revokeObjectURL(importedObjectUrlRef.current);
  }, []);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => current === message ? null : current), 2800);
  };

  const patchPreferences = (patch: Partial<ViewerPreferences>) => {
    setPreferences((current) => ({ ...current, ...patch }));
  };

  const persist = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    notify("Viewer preferences saved locally");
  };

  const openModelPicker = () => fileInputRef.current?.click();

  const releaseImportedModel = () => {
    if (!importedObjectUrlRef.current) return;
    URL.revokeObjectURL(importedObjectUrlRef.current);
    importedObjectUrlRef.current = null;
  };

  const importModel = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) {
      notify("Choose a GLB model file.");
      return;
    }

    releaseImportedModel();
    const objectUrl = URL.createObjectURL(file);
    importedObjectUrlRef.current = objectUrl;
    setModel({
      name: modelNameFromFile(file.name),
      url: objectUrl,
      origin: "imported",
      subtitle: `${formatFileSize(file.size)} · Session import`,
      attribution: `${file.name} · displayed locally for this session`,
    });
    setModelLoadState("loading");
    setMobilePane("scene");
    notify(`${file.name} opened as a project`);
  };

  const resetToInitialProject = () => {
    if (model.origin === "bundled") {
      notify("The default project is already active");
      return;
    }
    releaseImportedModel();
    setModel(INITIAL_MODEL);
    setModelLoadState("loading");
    setMobilePane("scene");
    notify("Default project restored");
  };

  const exportScreenshot = async () => {
    const blob = await viewportRef.current?.capturePng();
    if (!blob) return notify("The screenshot could not be generated.");
    downloadFile(blob, `${safeFilename(preferences.projectName)}-${safeFilename(model.name)}.png`, "image/png");
    notify("Model screenshot exported");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark"><Bone size={22} /></div>
          <div><strong>OsteoPlot</strong><span>3D SKELETAL REFERENCE</span></div>
        </div>
        <div className="project-title-block">
          <span className="offline-badge"><ShieldCheck size={14} /> Offline collection</span>
          <input
            aria-label="Collection name"
            value={preferences.projectName}
            onChange={(event) => patchPreferences({ projectName: event.target.value })}
          />
        </div>
        <div className="header-actions">
          <button type="button" className="header-button" onClick={openModelPicker}><Upload size={17} /><span>Switch Project</span></button>
          <button type="button" className="header-button" onClick={persist}><Save size={17} /><span>Save</span></button>
          <button type="button" className="primary-header-button" onClick={() => void exportScreenshot()}><Camera size={17} /><span>Screenshot</span></button>
          <button
            type="button"
            className="mobile-menu-button"
            aria-label="Toggle model details"
            onClick={() => setMobilePane((pane) => pane === "scene" ? "details" : "scene")}
          >
            <PanelRight size={20} />
          </button>
        </div>
      </header>

      <input
        ref={fileInputRef}
        className="model-file-input"
        type="file"
        accept=".glb,model/gltf-binary"
        aria-label="Choose another project GLB"
        onChange={(event) => {
          importModel(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />

      <main className="workspace-grid model-viewer-grid">
        <section className={`viewport-section ${mobilePane === "scene" ? "mobile-active" : ""}`}>
          <SceneViewport
            ref={viewportRef}
            modelUrl={model.url}
            modelName={model.name}
            showGrid={showGrid}
            onLoadStateChange={setModelLoadState}
          />
          <div className="viewport-topbar">
            <div className="active-model-label">
              <Bone size={16} />
              <span><strong>{model.name}</strong><small>{model.origin === "bundled" ? "DEFAULT PROJECT" : "IMPORTED PROJECT"}</small></span>
            </div>
            <div className="viewport-tools">
              <button type="button" className={showGrid ? "active" : ""} onClick={() => setShowGrid((value) => !value)} title="Coordinate grid"><Grid3X3 size={18} /></button>
              <button type="button" onClick={() => viewportRef.current?.focusModel()} title="Focus model"><Focus size={18} /></button>
              <button type="button" onClick={() => viewportRef.current?.resetCamera()} title="Reset camera"><RotateCcw size={18} /></button>
            </div>
          </div>
          <div className="collection-badge"><span>SINGLE PROJECT WORKSPACE</span><strong>Switch projects with a compatible GLB</strong></div>
          <div className="orientation-cube" aria-hidden="true">
            <span className="axis-y">Y↑</span><span className="axis-x">X→</span><span className="axis-z">Z↘</span>
          </div>
          <div className="viewport-caption">
            <span className="pulse-dot" />
            <div><strong>{model.name}</strong><small>{model.subtitle}</small></div>
          </div>
          {modelLoadState !== "ready" && (
            <div className={`model-load-state ${modelLoadState}`}>
              {modelLoadState === "loading" ? "Loading and normalising model…" : "This GLB model could not be displayed."}
            </div>
          )}
          <div className="touch-hint">Drag to rotate · Pinch or scroll to zoom · Two-finger pan</div>
        </section>

        <div className={`workspace-pane right-pane ${mobilePane === "details" ? "mobile-active" : ""}`}>
          <DetailsPanel
            model={model}
            coordinates={BACKEND_COORDINATES}
            notes={preferences.notes}
            isInitialProject={model.origin === "bundled"}
            onImportClick={openModelPicker}
            onResetProject={resetToInitialProject}
            onNotesChange={(notes) => patchPreferences({ notes })}
          />
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button type="button" className={mobilePane === "scene" ? "active" : ""} onClick={() => setMobilePane("scene")}><Database size={19} />3D Model</button>
        <button type="button" className={mobilePane === "details" ? "active" : ""} onClick={() => setMobilePane("details")}><PanelRight size={19} />Details</button>
      </nav>

      {toast && <div className="toast"><ShieldCheck size={17} />{toast}<button type="button" onClick={() => setToast(null)}><X size={15} /></button></div>}
    </div>
  );
}

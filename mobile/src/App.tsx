import { useEffect, useRef, useState } from "react";
import {
  Bone,
  Camera,
  ClipboardList,
  Database,
  Focus,
  Grid3X3,
  Info,
  PanelRight,
  RotateCcw,
  Save,
  ShieldCheck,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { CoordinatePanel } from "./components/CoordinatePanel";
import { DetailsPanel } from "./components/DetailsPanel";
import { SceneViewport, type SceneViewportHandle } from "./components/SceneViewport";
import { CFA_GROUPS, type PointGroupId, type PointName } from "./data/cfaSchema";
import { toBackendLandmarks } from "./lib/backendCoordinates";
import { parseCoordinateCsv, serialiseCoordinateCsv } from "./lib/coordinateCsv";
import { exportCsv } from "./lib/csvExport";
import { downloadFile, safeFilename } from "./lib/projectStorage";
import type { CoordinateDraft, ModelLoadState, SkeletonRecord, ViewerModel } from "./types";

type MobilePane = "scene" | "panel";
type SidePanel = "coordinates" | "details";

interface ViewerPreferences {
  workspaceName: string;
  records: SkeletonRecord[];
  activeRecordId: string;
}

const STORAGE_KEY = "osteoplot.reference-viewer.v1";
const DEFAULT_RECORD: SkeletonRecord = {
  id: "skeleton-record-1",
  name: "Skeleton 1",
  coordinates: {},
  excludedGroups: [],
  notes: "",
};
const DEFAULT_PREFERENCES: ViewerPreferences = {
  workspaceName: "Skeletal Model Workspace",
  records: [DEFAULT_RECORD],
  activeRecordId: DEFAULT_RECORD.id,
};

const INITIAL_MODEL: ViewerModel = {
  name: "Skeleton Reference",
  url: "/models/skeleton_pre-cut.glb",
  origin: "bundled",
  subtitle: "Bundled anatomical reference · GLB",
  attribution: "Skeleton Pre-cut · Maxime66410 · Sketchfab Standard",
};

const GROUP_IDS = new Set<PointGroupId>(CFA_GROUPS.map((group) => group.id));

function modelNameFromFile(fileName: string): string {
  const name = fileName.replace(/\.glb$/i, "").replace(/[-_]+/g, " ").trim();
  if (!name) return "Imported Model";
  return name.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function createRecord(index: number): SkeletonRecord {
  return {
    id: `skeleton-record-${crypto.randomUUID()}`,
    name: `Skeleton ${index}`,
    coordinates: {},
    excludedGroups: [],
    notes: "",
  };
}

function normaliseRecord(value: unknown, index: number): SkeletonRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SkeletonRecord>;
  if (typeof candidate.id !== "string" || !candidate.id) return null;
  const excludedGroups = Array.isArray(candidate.excludedGroups)
    ? candidate.excludedGroups.filter((group): group is PointGroupId => GROUP_IDS.has(group as PointGroupId))
    : [];
  return {
    id: candidate.id,
    name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name : `Skeleton ${index}`,
    coordinates: candidate.coordinates && typeof candidate.coordinates === "object" ? candidate.coordinates : {},
    excludedGroups,
    notes: typeof candidate.notes === "string" ? candidate.notes : "",
  };
}

function loadPreferences(): ViewerPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const saved = JSON.parse(raw) as Partial<ViewerPreferences> & { projectName?: unknown; notes?: unknown };
    const records = Array.isArray(saved.records)
      ? saved.records.map(normaliseRecord).filter((record): record is SkeletonRecord => Boolean(record))
      : [];

    if (records.length === 0) {
      records.push({
        ...DEFAULT_RECORD,
        notes: typeof saved.notes === "string" ? saved.notes : "",
      });
    }

    const activeRecordId = typeof saved.activeRecordId === "string" && records.some((record) => record.id === saved.activeRecordId)
      ? saved.activeRecordId
      : records[0].id;

    return {
      workspaceName: typeof saved.workspaceName === "string"
        ? saved.workspaceName
        : typeof saved.projectName === "string"
          ? saved.projectName
          : DEFAULT_PREFERENCES.workspaceName,
      records,
      activeRecordId,
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
  const [sidePanel, setSidePanel] = useState<SidePanel>("coordinates");
  const [toast, setToast] = useState<string | null>(null);
  const viewportRef = useRef<SceneViewportHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importedObjectUrlRef = useRef<string | null>(null);

  const activeRecord = preferences.records.find((record) => record.id === preferences.activeRecordId) ?? preferences.records[0];
  const backendCoordinates = toBackendLandmarks(activeRecord);

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

  const patchActiveRecord = (update: (record: SkeletonRecord) => SkeletonRecord) => {
    setPreferences((current) => ({
      ...current,
      records: current.records.map((record) => record.id === current.activeRecordId ? update(record) : record),
    }));
  };

  const persist = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    notify(`${preferences.records.length} skeleton record${preferences.records.length === 1 ? "" : "s"} saved locally`);
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
    notify(`${file.name} opened as the reference model`);
  };

  const resetToInitialModel = () => {
    if (model.origin === "bundled") {
      notify("The bundled reference model is already active");
      return;
    }
    releaseImportedModel();
    setModel(INITIAL_MODEL);
    setModelLoadState("loading");
    setMobilePane("scene");
    notify("Bundled reference model restored");
  };

  const addRecord = () => {
    const record = createRecord(preferences.records.length + 1);
    setPreferences((current) => ({
      ...current,
      records: [...current.records, record],
      activeRecordId: record.id,
    }));
    setSidePanel("coordinates");
    setMobilePane("panel");
    notify(`${record.name} created`);
  };

  const setCoordinate = (point: PointName, axis: 0 | 1 | 2, value: number | null) => {
    patchActiveRecord((record) => {
      const coordinate: CoordinateDraft = [...(record.coordinates[point] ?? [null, null, null])] as CoordinateDraft;
      coordinate[axis] = value;
      return { ...record, coordinates: { ...record.coordinates, [point]: coordinate } };
    });
  };

  const setGroupPresence = (groupId: PointGroupId, present: boolean) => {
    patchActiveRecord((record) => ({
      ...record,
      excludedGroups: present
        ? record.excludedGroups.filter((id) => id !== groupId)
        : [...new Set([...record.excludedGroups, groupId])],
    }));
  };

  const resetCoordinates = () => {
    const hasData = Object.keys(activeRecord.coordinates).length > 0 || activeRecord.excludedGroups.length > 0;
    if (!hasData) {
      notify("This record is already empty");
      return;
    }
    if (!window.confirm(`Reset all coordinates and presence settings for ${activeRecord.name}?`)) return;
    patchActiveRecord((record) => ({ ...record, coordinates: {}, excludedGroups: [] }));
    notify(`${activeRecord.name} coordinates reset`);
  };

  const exportScreenshot = async () => {
    const blob = await viewportRef.current?.capturePng();
    if (!blob) return notify("The screenshot could not be generated.");
    downloadFile(blob, `${safeFilename(preferences.workspaceName)}-${safeFilename(model.name)}.png`, "image/png");
    notify("Model screenshot exported");
  };

  const exportActiveRecord = async () => {
    try {
      const result = await exportCsv(
        serialiseCoordinateCsv(activeRecord),
        `${safeFilename(activeRecord.name)}-coordinates.csv`,
      );
      notify(result.destination === "documents"
        ? `CSV saved to ${result.displayPath}`
        : `${backendCoordinates.length} backend-ready point${backendCoordinates.length === 1 ? "" : "s"} exported`);
    } catch (error) {
      console.error("Coordinate export failed", error);
      notify("The coordinate CSV could not be saved");
    }
  };

  const importCoordinateCsv = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      notify("Choose a CSV coordinate file.");
      return;
    }

    try {
      const result = parseCoordinateCsv(await file.text());
      if (result.records.length === 0) {
        notify(result.warnings[0] ?? "The CSV contains no usable coordinates");
        return;
      }

      const importedRecords: SkeletonRecord[] = result.records.map((record) => ({
        id: `skeleton-record-${crypto.randomUUID()}`,
        name: record.name,
        coordinates: record.coordinates,
        excludedGroups: [],
        notes: "",
      }));
      setPreferences((current) => ({
        ...current,
        records: [...current.records, ...importedRecords],
        activeRecordId: importedRecords[0].id,
      }));
      setSidePanel("coordinates");
      setMobilePane("panel");
      notify(`${importedRecords.length} CSV record${importedRecords.length === 1 ? "" : "s"} imported${result.warnings.length ? ` · ${result.warnings.length} row warning${result.warnings.length === 1 ? "" : "s"}` : ""}`);
    } catch (error) {
      console.error("Coordinate import failed", error);
      notify("The coordinate CSV could not be read");
    }
  };

  const showPanel = (panel: SidePanel) => {
    setSidePanel(panel);
    setMobilePane("panel");
  };

  const saveFromCoordinates = () => {
    persist();
    showPanel("coordinates");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark"><Bone size={22} /></div>
          <div><strong>Skeletal Coordinate App</strong><span>SKELETAL COORDINATE WORKSPACE</span></div>
        </div>
        <div className="project-title-block">
          <span className="offline-badge"><ShieldCheck size={14} /> Offline workspace</span>
          <input
            aria-label="Workspace name"
            value={preferences.workspaceName}
            onChange={(event) => patchPreferences({ workspaceName: event.target.value })}
          />
        </div>
        <div className="header-actions">
          <button type="button" className="header-button" onClick={openModelPicker}><Upload size={17} /><span>Switch Model</span></button>
          <button type="button" className="header-button" onClick={persist}><Save size={17} /><span>Save</span></button>
          <button type="button" className="primary-header-button" onClick={() => void exportScreenshot()}><Camera size={17} /><span>Screenshot</span></button>
          <button
            type="button"
            className="mobile-menu-button"
            aria-label="Toggle workspace panel"
            onClick={() => setMobilePane((pane) => pane === "scene" ? "panel" : "scene")}
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
        aria-label="Choose another reference model GLB"
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
              <span><strong>{model.name}</strong><small>{model.origin === "bundled" ? "BUNDLED REFERENCE" : "IMPORTED REFERENCE"}</small></span>
            </div>
            <div className="viewport-tools">
              <button type="button" className={showGrid ? "active" : ""} onClick={() => setShowGrid((value) => !value)} title="Coordinate grid"><Grid3X3 size={18} /></button>
              <button type="button" onClick={() => viewportRef.current?.focusModel()} title="Focus model"><Focus size={18} /></button>
              <button type="button" onClick={() => viewportRef.current?.resetCamera()} title="Reset camera"><RotateCcw size={18} /></button>
            </div>
          </div>
          <button type="button" className="active-record-badge" onClick={() => showPanel("coordinates")}>
            <ClipboardList size={15} />
            <span>
              <strong>{activeRecord.name.trim() || "Untitled skeleton"}</strong>
              <small>{backendCoordinates.length} BACKEND-READY POINTS</small>
            </span>
          </button>
          <div className="viewport-zoom-tools" aria-label="Model zoom controls">
            <button type="button" onClick={() => viewportRef.current?.zoomBy(0.82)} title="Zoom in"><ZoomIn size={18} /></button>
            <button type="button" onClick={() => viewportRef.current?.zoomBy(1.22)} title="Zoom out"><ZoomOut size={18} /></button>
          </div>
          <div className="collection-badge"><span>REFERENCE MODEL</span><strong>{activeRecord.name} · {backendCoordinates.length} backend-ready points</strong></div>
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

        <div className={`workspace-pane right-pane side-panel-shell ${mobilePane === "panel" ? "mobile-active" : ""}`}>
          <div className="side-panel-tabs" role="tablist" aria-label="Workspace tools">
            <button type="button" role="tab" aria-selected={sidePanel === "coordinates"} className={sidePanel === "coordinates" ? "active" : ""} onClick={() => setSidePanel("coordinates")}>
              <ClipboardList size={15} /> Coordinates
            </button>
            <button type="button" role="tab" aria-selected={sidePanel === "details"} className={sidePanel === "details" ? "active" : ""} onClick={() => setSidePanel("details")}>
              <Info size={15} /> Details
            </button>
          </div>
          <div className="side-panel-body">
            {sidePanel === "coordinates" ? (
              <CoordinatePanel
                records={preferences.records}
                activeRecord={activeRecord}
                onSelectRecord={(activeRecordId) => patchPreferences({ activeRecordId })}
                onCreateRecord={addRecord}
                onRenameRecord={(name) => patchActiveRecord((record) => ({ ...record, name }))}
                onCoordinateChange={setCoordinate}
                onGroupPresenceChange={setGroupPresence}
                onResetCoordinates={resetCoordinates}
                onImportCsv={(file) => void importCoordinateCsv(file)}
                onExportRecord={() => void exportActiveRecord()}
                onSave={saveFromCoordinates}
                canExport={backendCoordinates.length > 0}
              />
            ) : (
              <DetailsPanel
                model={model}
                recordName={activeRecord.name}
                coordinates={backendCoordinates}
                notes={activeRecord.notes}
                isInitialModel={model.origin === "bundled"}
                onImportClick={openModelPicker}
                onResetModel={resetToInitialModel}
                onNotesChange={(notes) => patchActiveRecord((record) => ({ ...record, notes }))}
              />
            )}
          </div>
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button type="button" className={mobilePane === "scene" ? "active" : ""} onClick={() => setMobilePane("scene")}><Database size={19} />3D Model</button>
        <button type="button" className={mobilePane === "panel" && sidePanel === "coordinates" ? "active" : ""} onClick={() => showPanel("coordinates")}><ClipboardList size={19} />Coordinates</button>
        <button type="button" className={mobilePane === "panel" && sidePanel === "details" ? "active" : ""} onClick={() => showPanel("details")}><PanelRight size={19} />Details</button>
      </nav>

      {toast && <div className={`toast ${mobilePane === "panel" && sidePanel === "coordinates" ? "above-coordinate-actions" : ""}`}><ShieldCheck size={17} />{toast}<button type="button" onClick={() => setToast(null)}><X size={15} /></button></div>}
    </div>
  );
}

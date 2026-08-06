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
      .catch(() => notify("示例数据未加载；可使用“导入数据”选择本地文件。"));
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
        if (!isProjectData(imported)) throw new Error("JSON 不是有效的 OsteoPlot 项目文件。" );
        setProject({ ...imported, updatedAt: new Date().toISOString() });
        setSelectedId(imported.layers.find((layer) => !layer.locked)?.id ?? imported.layers[0]?.id ?? null);
        notify(`已载入项目：${imported.name}`);
        return;
      }
      const result = extension === "rot" ? parseRot(text, file.name) : parseCsv(text, file.name);
      if (result.layers.length === 0) throw new Error(result.warnings[0] ?? "文件没有可用坐标。" );
      setProject((current) => ({ ...current, layers: [...current.layers, ...result.layers] }));
      setSelectedId(result.layers.find((layer) => !layer.locked)?.id ?? result.layers[0].id);
      notify(`已导入 ${result.layers.length} 个图层${result.warnings.length ? `，${result.warnings.length} 条提示` : ""}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "导入失败，请检查文件格式。" );
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
    notify(`${entry.skeletonId} · ${entry.pointName} 已添加`);
  };

  const removeLayer = (id: string) => {
    const layer = project.layers.find((item) => item.id === id);
    if (!layer || !window.confirm(`确定删除 ${layer.name}？此操作尚未保存。`)) return;
    setProject((current) => ({ ...current, layers: current.layers.filter((item) => item.id !== id) }));
    setSelectedId(project.layers.find((item) => item.id !== id && !item.locked)?.id ?? null);
  };

  const persist = () => {
    setProject((current) => saveProject(current));
    notify("项目已安全保存到本机");
  };

  const exportJson = () => {
    const updated = { ...project, updatedAt: new Date().toISOString() };
    downloadFile(JSON.stringify(updated, null, 2), `${safeFilename(project.name)}.json`, "application/json");
    setExportOpen(false);
    notify("项目 JSON 已导出");
  };

  const exportScreenshot = async () => {
    const blob = await viewportRef.current?.capturePng();
    if (!blob) return notify("截图生成失败。" );
    downloadFile(blob, `${safeFilename(project.name)}-viewport.png`, "image/png");
    setExportOpen(false);
    notify("3D 视图截图已导出");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark"><Bone size={22} /></div>
          <div><strong>OsteoPlot</strong><span>3D SKELETAL ANNOTATION</span></div>
        </div>
        <div className="project-title-block">
          <span className="offline-badge"><ShieldCheck size={14} /> 离线项目</span>
          <input
            aria-label="项目名称"
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
          <button type="button" className="header-button" onClick={() => setManualOpen(true)}><Plus size={17} /><span>手动测点</span></button>
          <button type="button" className="header-button" onClick={() => fileInputRef.current?.click()}><Upload size={17} /><span>导入数据</span></button>
          <button type="button" className="header-button" onClick={persist}><Save size={17} /><span>保存</span></button>
          <div className="export-menu-wrap">
            <button type="button" className="primary-header-button" onClick={() => setExportOpen((open) => !open)}><Download size={17} /><span>导出</span></button>
            {exportOpen && (
              <div className="export-menu">
                <button type="button" onClick={() => void exportScreenshot()}><Camera size={17} /><span><strong>视图截图</strong><small>PNG · 当前相机角度</small></span></button>
                <button type="button" onClick={exportJson}><FileJson size={17} /><span><strong>项目数据</strong><small>JSON · 可重新载入</small></span></button>
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
              <span><Layers3 size={14} /> {bodyLayers.length} 个体</span>
              <span><Crosshair size={14} /> {totalPoints.toLocaleString()} 测点</span>
            </div>
            <div className="viewport-tools">
              <button type="button" className={showGrid ? "active" : ""} onClick={() => setShowGrid((value) => !value)} title="坐标网格"><Grid3X3 size={18} /></button>
              <button type="button" className={showModels ? "active" : ""} onClick={() => setShowModels((value) => !value)} title="参考模型"><Bone size={18} /></button>
              <button type="button" onClick={() => viewportRef.current?.focusSelected()} title="聚焦所选"><Focus size={18} /></button>
              <button type="button" onClick={() => viewportRef.current?.resetCamera()} title="重置相机"><RotateCcw size={18} /></button>
            </div>
          </div>
          <div className="orientation-cube" aria-hidden="true">
            <span className="axis-y">Z↑</span><span className="axis-x">X→</span><span className="axis-z">Y↘</span>
          </div>
          <div className="viewport-caption">
            <span className="pulse-dot" />
            <div><strong>{selectedLayer?.name ?? "未选择"}</strong><small>{selectedLayer ? `${selectedLayer.sourceName} · X/Z/Y survey coordinates` : "点击骨架选择个体"}</small></div>
          </div>
          <div className="touch-hint">单指旋转 · 双指缩放/平移 · 轻触选择</div>
        </section>

        <div className={`workspace-pane right-pane ${mobilePane === "details" ? "mobile-active" : ""}`}>
          <DetailsPanel layer={selectedLayer} onPatch={patchLayer} onRemove={removeLayer} />
        </div>
      </main>

      <nav className="mobile-nav" aria-label="移动端导航">
        <button type="button" className={mobilePane === "layers" ? "active" : ""} onClick={() => setMobilePane("layers")}><ListTree size={19} />图层</button>
        <button type="button" className={mobilePane === "scene" ? "active" : ""} onClick={() => setMobilePane("scene")}><Database size={19} />3D 场景</button>
        <button type="button" className={mobilePane === "details" ? "active" : ""} onClick={() => setMobilePane("details")}><PanelRight size={19} />详情</button>
      </nav>

      <ManualEntryDialog open={manualOpen} onClose={() => setManualOpen(false)} onAdd={addManualPoint} />
      {toast && <div className="toast"><ShieldCheck size={17} />{toast}<button type="button" onClick={() => setToast(null)}><X size={15} /></button></div>}
    </div>
  );
}

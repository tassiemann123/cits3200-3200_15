import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Bone, Box, Check, ChevronDown, ChevronRight, CircleHelp, Eye, EyeOff, FileJson, FolderOpen, Grid2X2, Layers3, Link2, MapPin, Maximize, Minus, MoreHorizontal, MousePointer2, Plus, RotateCcw, Search, SlidersHorizontal, Table2, Unlink2, Wifi, WifiOff, X } from 'lucide-react';
import { applyScenario, createBlankProject, createDemoProject, getRenderableBones, setBoneStatus, setJointLinked, updateCoordinate, validateProject } from './model';
import type { BoneStatus, Individual, Project } from './model';
import SceneViewport from './components/SceneViewport';
import { registerOffline } from './offline';

const STORAGE_KEY = 'osteo.desktop.project.v2';
type Scenario = 'articulated' | 'disarticulated' | 'missing-femur';
type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
const SCENARIOS: { id: Scenario; label: string; detail: string }[] = [
  { id: 'articulated', label: 'Articulated joint', detail: 'Matching coordinates for both contributing bone ends.' },
  { id: 'disarticulated', label: 'Separated joint', detail: 'Independent femur and lower-leg endpoints at the left knee.' },
  { id: 'missing-femur', label: 'Missing femur', detail: 'The left femur is absent. The pelvis and lower leg remain.' },
];

function restoreProject(): { project: Project; error: string | null } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { project: validateProject(JSON.parse(stored)), error: null };
    const previous = localStorage.getItem('osteo.desktop.project.v1');
    if (previous) {
      const old = validateProject(JSON.parse(previous));
      // Retain edited records. Only the untouched synthetic starter is replaced.
      if (JSON.stringify(old.individuals) !== JSON.stringify(createDemoProject().individuals)) return { project: old, error: null };
    }
    return { project: createBlankProject(), error: null };
  } catch {
    return { project: createBlankProject(), error: 'The saved workspace could not be read. A demo is open; the original saved data has been left untouched. Export it or import a valid backup before continuing.' };
  }
}

function download(contents: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function coordinateLabel(value: number | null | undefined) {
  return value == null ? '—' : value.toFixed(3);
}

function CoordinateInput({ value, label, onCommit, disabled }: { value: number | null; label: string; onCommit: (value: number | null) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setDraft(value == null ? '' : String(value)); setInvalid(false); }, [value]);
  const commit = () => {
    const next = draft.trim() === '' ? null : Number(draft);
    if (next !== null && (!Number.isFinite(next) || Math.abs(next) > 1e7)) { setInvalid(true); return; }
    setInvalid(false); onCommit(next);
  };
  return <input aria-label={label} type="text" inputMode="decimal" className={invalid ? 'invalid' : ''} aria-invalid={invalid} disabled={disabled} value={draft} placeholder="—" onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(value == null ? '' : String(value)); setInvalid(false); } }} title={invalid ? 'Enter a finite number between -10,000,000 and 10,000,000.' : label} />;
}

function SkeletonGlyph({ color, absent = false }: { color: string; absent?: boolean }) {
  return <svg width="38" height="55" viewBox="0 0 40 58" fill="none" aria-hidden="true"><g stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="20" cy="8" r="4" /><path d="M20 13v18m-9-14 9-2 9 2M11 17 8 27 7 33m22-16 3 10 1 6M13 32h14l-7 5-7-5Zm-1-12 8 4 8-4m-15 5 7 3 7-3" /><path d="m24 35 3 10 1 10" />{!absent && <path d="m16 35-3 10" />}<path d="m13 45-1 10" /></g></svg>;
}

export default function App() {
  const [initial] = useState(restoreProject);
  const [project, setProject] = useState(initial.project);
  const [selectedId, setSelectedId] = useState(initial.project.individuals[0]?.id ?? '');
  const [jointId, setJointId] = useState('left_knee');
  const [query, setQuery] = useState('');
  const [jointSearch, setJointSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [inspectorTab, setInspectorTab] = useState<'coordinates' | 'inventory'>('coordinates');
  const [view, setView] = useState<'perspective' | 'front' | 'top'>('perspective');
  const [showGrid, setShowGrid] = useState(true);
  const [showMarkers, setShowMarkers] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [frameKey, setFrameKey] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [mainTab, setMainTab] = useState<'scene' | 'table'>('scene');
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  const [offlineError, setOfflineError] = useState('');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saving');
  const [storageBlocked, setStorageBlocked] = useState(Boolean(initial.error));
  const [toast, setToast] = useState(initial.error ?? '');
  const [modal, setModal] = useState<'help' | 'export' | 'add' | 'import' | 'notes' | null>(null);
  const [pendingProject, setPendingProject] = useState<Project | null>(null);
  const [newName, setNewName] = useState('');
  const [newAccession, setNewAccession] = useState('');
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [scenarioMenu, setScenarioMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = project.individuals.find(i => i.id === selectedId) ?? project.individuals[0];
  const joint = selected?.joints.find(j => j.id === jointId) ?? selected?.joints[0];
  const expandKey = `${selected?.id}:${joint?.id}`;
  const isExpanded = Boolean(expanded[expandKey]);
  const visibleCount = project.individuals.filter(i => i.visible).length;
  const plottedBones = project.individuals.filter(i => i.visible).reduce((n, i) => n + getRenderableBones(i).length, 0);
  const missingCount = selected?.bones.filter(b => b.status === 'absent').length ?? 0;
  const unrecordedCount = selected?.bones.filter(b => b.status === 'unrecorded').length ?? 0;

  const notify = (message: string) => setToast(message);
  const changeIndividual = (fn: (i: Individual) => Individual) => setProject(p => ({ ...p, updatedAt: new Date().toISOString(), individuals: p.individuals.map(i => i.id === selected.id ? fn(i) : i) }));

  useEffect(() => {
    if (storageBlocked) { setSaveState('error'); return; }
    setSaveState('saving');
    const timer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); setSaveState('saved'); }
      catch { setSaveState('error'); notify('Local saving failed. Export your workspace to keep a backup.'); }
    }, 250);
    return () => clearTimeout(timer);
  }, [project, storageBlocked]);

  useEffect(() => {
    const flush = () => { if (!storageBlocked) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); } catch { /* Visible save status reports failure. */ } } };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [project, storageBlocked]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const install = (e: Event) => { e.preventDefault(); setInstallEvent(e as InstallEvent); };
    window.addEventListener('online', update); window.addEventListener('offline', update);
    window.addEventListener('beforeinstallprompt', install);
    const cleanOffline = registerOffline(() => { setOfflineReady(true); setOfflineError(''); }, message => { setOfflineError(message); notify(message); });
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); window.removeEventListener('beforeinstallprompt', install); cleanOffline(); };
  }, []);

  useEffect(() => { if (!toast || storageBlocked) return; const id = setTimeout(() => setToast(''), 6500); return () => clearTimeout(id); }, [toast, storageBlocked]);
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === 'Escape') { setModal(null); setScenarioMenu(false); } }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close); }, []);

  const importFile = async (file: File) => {
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Please choose a workspace smaller than 5 MB.');
      const next = validateProject(JSON.parse(await file.text()));
      setPendingProject(next); setModal('import');
    } catch (error) { notify(`Import failed: ${error instanceof Error ? error.message : 'Invalid workspace file.'}`); }
  };

  const exportJson = () => { download(JSON.stringify(project, null, 2), `osteo-workspace-${new Date().toISOString().slice(0, 10)}.json`, 'application/json'); setModal(null); notify('Workspace exported. Both coordinate sets and bone inventory are included.'); };
  const exportCsv = () => {
    const cell = (value: unknown) => { let s = String(value ?? ''); if (typeof value === 'string' && /^[=+@\-\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
    const rows: unknown[][] = [['Accession', 'Individual', 'Joint', 'Bone', 'Status', 'X', 'Y', 'Z', 'Coordinates linked']];
    for (const person of project.individuals) for (const point of person.joints) for (const endpoint of point.endpoints) rows.push([person.accession, person.name, point.label, endpoint.label, person.bones.find(b => b.id === endpoint.boneId)?.status ?? 'unrecorded', ...endpoint.coordinate, point.linked ? 'yes' : 'no']);
    download(rows.map(row => row.map(cell).join(',')).join('\r\n'), 'osteo-bone-coordinates.csv', 'text/csv;charset=utf-8');
    setModal(null); notify('Bone-specific coordinate table exported. Use JSON for a restorable workspace.');
  };

  const loadScenario = (scenario: Scenario) => {
    const required = ['left_acetabulum', 'left_knee', 'left_ankle'];
    if (!required.every(id => selected.joints.find(j => j.id === id)?.endpoints.every(e => e.coordinate.every(n => n !== null)))) {
      notify('This example needs recorded left hip, knee and ankle coordinates. Select a demo individual or complete these landmarks first.');
      setScenarioMenu(false); return;
    }
    changeIndividual(i => applyScenario(i, scenario));
    setJointId('left_knee'); setInspectorTab('coordinates'); setScenarioMenu(false);
    setExpanded(p => ({ ...p, [`${selected.id}:left_knee`]: scenario === 'disarticulated' }));
    notify(`${SCENARIOS.find(s => s.id === scenario)?.label} demo applied to ${selected.name}.`);
  };

  const addIndividual = () => {
    if (!newName.trim() || !newAccession.trim()) return;
    if (project.individuals.length >= 100) { notify('This prototype supports up to 100 individuals per workspace.'); return; }
    const base = createBlankProject().individuals[0];
    const person: Individual = { ...base, id: crypto.randomUUID(), name: newName.trim(), accession: newAccession.trim(), color: ['#355c7d', '#b08e59', '#7189a4', '#9b788c'][project.individuals.length % 4], visible: true, notes: '', joints: base.joints.map(j => ({ ...j, linked: j.endpoints.length === 2, endpoints: j.endpoints.map(e => ({ ...e, coordinate: [null, null, null] })) })), bones: base.bones.map(b => ({ ...b, status: 'present' })) };
    setProject(p => ({ ...p, updatedAt: new Date().toISOString(), individuals: [...p.individuals, person] }));
    setSelectedId(person.id); setJointId('left_knee'); setModal(null); setNewName(''); setNewAccession('');
    notify('Blank individual added. Enter coordinates to display bones; update the inventory when needed.');
  };

  return <div className="app-shell">
    <aside className="app-rail" aria-label="Application navigation">
      <div className="brand-mark" aria-label="OSTEO"><Bone size={25} strokeWidth={1.65} /></div>
      <button className="rail-button active" title="Skeleton workspace" aria-label="Skeleton workspace" onClick={() => setMainTab('scene')}><Layers3 size={21} /></button>
      <button className="rail-button" title="Import workspace" aria-label="Import workspace" onClick={() => fileRef.current?.click()}><FolderOpen size={21} /></button>
      <button className="rail-button" title="Coordinate table" aria-label="Coordinate table" onClick={() => setMainTab('table')}><Table2 size={21} /></button>
      <div className="rail-spacer" />
      <span className="rail-version">D / 01</span>
      <button className="rail-button" title="Prototype guide" aria-label="Prototype guide" onClick={() => setModal('help')}><CircleHelp size={21} /></button>
      <div className="avatar" title="Local workspace">CF</div>
    </aside>

    <div className="application">
      <main className="workbench">
        <aside className="individuals-panel">
          <div className="panel-title"><h2>Individuals <span className="count-badge">{project.individuals.length.toString().padStart(2, '0')}</span></h2><button className="icon-button" aria-label="Add individual" onClick={() => setModal('add')}><Plus size={17} /></button></div>
          <label className="search-field"><Search size={15} /><input aria-label="Search individuals" placeholder="Find an individual…" value={query} onChange={e => setQuery(e.target.value)} /><span>⌕</span></label>
          <div className="list-caption">CURRENT WORKSPACE <span>{visibleCount} visible</span></div>
          <div className="individual-list">
            {project.individuals.filter(i => `${i.name} ${i.accession}`.toLowerCase().includes(query.toLowerCase())).map(person => {
              const missing = person.bones.filter(b => b.status === 'absent').length;
              const hasCoordinates = person.joints.some(j => j.endpoints.some(e => e.coordinate.every(v => v !== null)));
              return <div className={`individual-card ${selected.id === person.id ? 'selected' : ''} ${!person.visible ? 'hidden-individual' : ''}`} key={person.id}>
                <button className="individual-select" onClick={() => { setSelectedId(person.id); setJointId('left_knee'); }}><div className="skeleton-thumb" style={{ backgroundColor: `${person.color}10` }}><SkeletonGlyph color={person.color} absent={missing > 0} /></div><div className="individual-info"><strong><i style={{ background: person.color }} />{person.name}</strong><span>{person.accession}</span><small>{!hasCoordinates ? 'Awaiting coordinates' : missing ? `${missing} bone absent` : 'No recorded absence'}</small></div></button>
                <button className="visibility-button" aria-label={`${person.visible ? 'Hide' : 'Show'} ${person.name}`} title={`${person.visible ? 'Hide' : 'Show'} individual`} onClick={() => setProject(p => ({ ...p, updatedAt: new Date().toISOString(), individuals: p.individuals.map(i => i.id === person.id ? { ...i, visible: !i.visible } : i) }))}>{person.visible ? <Eye size={15} /> : <EyeOff size={15} />}</button>
              </div>;
            })}
            {!project.individuals.some(i => `${i.name} ${i.accession}`.toLowerCase().includes(query.toLowerCase())) && <p className="empty-small">No individuals match your search.</p>}
            <button className="add-individual" onClick={() => setModal('add')}><Plus size={15} /> Add individual</button>
          </div>

          <div className="workspace-summary"><div className="eyebrow">WORKSPACE OVERVIEW</div><div><span>Individuals</span><strong>{project.individuals.length.toString().padStart(2, '0')}</strong></div><div><span>Visible segments</span><strong>{plottedBones}</strong></div><div><span>Coordinate system</span><strong>XYZ · metres</strong></div></div>
          <div className="left-bottom">
            <div className="workspace-actions"><button className="button" onClick={() => fileRef.current?.click()}><ArrowUpFromLine size={15} /> Import</button><button className="button primary" onClick={() => setModal('export')}><ArrowDownToLine size={15} /> Export</button></div>
            <span className={`save-indicator ${saveState}`} aria-live="polite">{saveState === 'saved' ? <Check size={13} /> : <span className="status-dot" />}{saveState === 'saved' ? 'Saved on this device' : saveState === 'saving' ? 'Saving…' : 'Local save unavailable'}</span>
          </div>
        </aside>

        <section className="viewer-panel" aria-label="Skeleton analysis workspace">
          <div className="viewer-tabs"><div className="tab-group"><button className={mainTab === 'scene' ? 'selected' : ''} onClick={() => setMainTab('scene')}><Box size={16} /> 3D workspace</button><button className={mainTab === 'table' ? 'selected' : ''} onClick={() => setMainTab('table')}><Table2 size={15} /> Coordinates</button></div><span className="view-count"><i /> {visibleCount} individuals</span></div>
          {mainTab === 'scene' ? <>
            <div className="scene-toolbar"><div className="view-toggle">{(['perspective', 'front', 'top'] as const).map(v => <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{v === 'perspective' ? '3D view' : v[0].toUpperCase() + v.slice(1)}</button>)}</div><div className="scene-options"><button className={showGrid ? 'active' : ''} aria-label="Toggle grid" aria-pressed={showGrid} title="Grid" onClick={() => setShowGrid(v => !v)}><Grid2X2 size={16} /></button><button className={showMarkers ? 'active' : ''} aria-label="Toggle recorded joint markers" aria-pressed={showMarkers} title="Recorded joint markers" onClick={() => setShowMarkers(v => !v)}><MapPin size={16} /></button><button className={showLabels ? 'active text-icon' : 'text-icon'} aria-label="Toggle labels" aria-pressed={showLabels} title="Labels" onClick={() => setShowLabels(v => !v)}>Aa</button><span /><button aria-label="Fit all skeletons" title="Fit all" onClick={() => { setFrameKey(n => n + 1); setZoom(1); }}><Maximize size={16} /></button></div></div>
            <div className="scene-area">
              <SceneViewport individuals={project.individuals} selectedId={selected.id} selectedJointId={joint?.id ?? ''} onSelect={(id, pointId) => { setSelectedId(id); setJointId(pointId); setInspectorTab('coordinates'); }} showGrid={showGrid} showMarkers={showMarkers} showLabels={showLabels} view={view} frameKey={frameKey} zoom={zoom * 100} />
              <div className="scene-corner-label"><span className="status-dot" /> SHARED COORDINATE SPACE</div>
              <div className="scene-legend">{project.individuals.filter(i => i.visible).map(i => <button key={i.id} className={i.id === selected.id ? 'active' : ''} onClick={() => setSelectedId(i.id)}><i style={{ background: i.color }} />{i.name}</button>)}</div>
              <div className="zoom-control"><button aria-label="Zoom in" onClick={() => setZoom(z => Math.min(3, z * 1.2))}><Plus size={16} /></button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom out" onClick={() => setZoom(z => Math.max(.35, z / 1.2))}><Minus size={16} /></button></div>
              {(visibleCount === 0 || !project.individuals.some(i => i.visible && i.joints.some(j => j.endpoints.some(e => e.coordinate.every(n => n !== null))))) && <div className="scene-empty"><Bone size={34} strokeWidth={1.3} /><strong>{visibleCount === 0 ? 'No visible skeletons' : 'Enter coordinates to start'}</strong><span>{visibleCount === 0 ? 'Show an individual from the list.' : 'Anatomical bone pieces appear as their landmarks are recorded.'}</span></div>}
            </div>
            <div className="scene-footer"><span>{showMarkers ? <><MousePointer2 size={13} /> Click a marker to inspect</> : <><MapPin size={13} /> Joint markers are hidden</>}</span><span>Drag to orbit <b>·</b> Right-drag to pan <b>·</b> Scroll to zoom</span></div>
          </> : null}

          <div className={`coordinate-table-panel ${mainTab === 'table' ? 'full-table' : ''}`}>
            <div className="table-heading"><div><h3>Landmark coordinates <span>{selected.name}</span></h3><p>Bone-specific endpoints · survey coordinates in metres</p></div><button className="icon-button" aria-label="Export coordinate table" title="Export coordinates as CSV" onClick={exportCsv}><ArrowDownToLine size={16} /></button></div>
            {mainTab === 'table' && <label className="search-field table-search"><Search size={15} /><input aria-label="Search landmarks" placeholder="Search landmarks…" value={jointSearch} onChange={e => setJointSearch(e.target.value)} /></label>}
            <div className="table-scroll"><table><thead><tr><th>LANDMARK</th><th>X</th><th>Y</th><th>Z</th><th>ENDPOINTS</th></tr></thead><tbody>{(mainTab === 'scene' ? selected.joints.filter(j => ['left_acetabulum', 'left_knee', 'left_ankle'].includes(j.id)) : selected.joints.filter(j => j.label.toLowerCase().includes(jointSearch.toLowerCase()))).map(j => <tr key={j.id} className={j.id === joint?.id ? 'selected' : ''} onClick={() => { setJointId(j.id); setInspectorTab('coordinates'); }}><td><button onClick={() => { setJointId(j.id); setInspectorTab('coordinates'); }}><span className="point-dot" />{j.label}</button></td>{j.endpoints[0].coordinate.map((n, k) => <td key={k} className="numeric">{coordinateLabel(n)}</td>)}<td><span className={`endpoint-badge ${!j.linked && j.endpoints.length > 1 ? 'split' : ''}`}>{j.endpoints.length === 1 ? 'Single' : j.linked ? <><Link2 size={11} /> Linked</> : <><Unlink2 size={11} /> Separate</>}</span></td></tr>)}</tbody></table></div>
            <div className="table-footnote">{mainTab === 'scene' ? <button onClick={() => setMainTab('table')}>View all {selected.joints.length} landmarks <ChevronRight size={12} /></button> : <span>{selected.joints.length} landmarks · first endpoint shown; select a row to inspect both</span>}<span>XYZ · m</span></div>
          </div>
        </section>

        <aside className="inspector-panel">
          <div className="panel-title"><h2>Inspector</h2><SlidersHorizontal size={16} /></div>
          <div className="inspector-person"><span style={{ background: selected.color }} />{selected.name}<small>{selected.accession}</small></div>
          <div className="inspector-tabs"><button className={inspectorTab === 'coordinates' ? 'active' : ''} onClick={() => setInspectorTab('coordinates')}>Coordinates</button><button className={inspectorTab === 'inventory' ? 'active' : ''} onClick={() => setInspectorTab('inventory')}>Bone inventory{missingCount > 0 && <i>{missingCount}</i>}</button></div>
          <div className="inspector-content">
            {inspectorTab === 'coordinates' && joint ? <>
              <label className="field-label" htmlFor="joint-select">SELECTED LANDMARK</label>
              <div className="select-wrap"><select id="joint-select" value={joint.id} onChange={e => setJointId(e.target.value)}>{selected.joints.map(j => <option value={j.id} key={j.id}>{j.label}</option>)}</select><ChevronDown size={15} /></div>
              <div className="joint-meta"><span>{joint.region.replace(/_/g, ' ')}</span><span>{joint.endpoints.length === 1 ? 'Terminal / landmark' : '2 bone endpoints'}</span></div>
              <div className="section-rule" />
              <div className="endpoint-title"><span className="endpoint-number">01</span><div><span>FIRST COORDINATE SET</span><h3>{joint.endpoints[0].label}</h3></div></div>
              <div className="coordinate-inputs">{(['X', 'Y', 'Z'] as const).map((axis, index) => <label key={axis}><span>{axis}<small>m</small></span><CoordinateInput key={`${expandKey}:0:${axis}`} value={joint.endpoints[0].coordinate[index]} label={`${joint.label} ${joint.endpoints[0].label} ${axis}`} onCommit={v => changeIndividual(i => updateCoordinate(i, joint.id, 0, index as 0 | 1 | 2, v))} /></label>)}</div>
              {selected.bones.find(b => b.id === joint.endpoints[0].boneId)?.status === 'absent' && <p className="inline-warning">This bone is marked absent. Stored coordinates are retained, but its segment is hidden.</p>}

              {joint.endpoints.length > 1 && <>
                <button className="expand-coordinates" aria-expanded={isExpanded} onClick={() => setExpanded(p => ({ ...p, [expandKey]: !p[expandKey] }))}><span>{isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}Second coordinate set</span><span className={joint.linked ? 'mini-linked' : 'mini-split'}>{joint.linked ? <Link2 size={13} /> : <Unlink2 size={13} />}{joint.linked ? 'Linked' : 'Separate'}</span></button>
                {isExpanded ? <div className="second-endpoint"><div className="endpoint-title"><span className="endpoint-number">02</span><div><span>SECOND COORDINATE SET</span><h3>{joint.endpoints[1].label}</h3></div></div><label className="link-toggle"><span><Link2 size={14} /> Keep coordinates identical</span><input type="checkbox" checked={joint.linked} onChange={e => {
                  if (e.target.checked && !window.confirm('Copy the first coordinate set to the second? This replaces its independent coordinates.')) return;
                  changeIndividual(i => setJointLinked(i, joint.id, e.target.checked));
                }} /><i /></label><div className="coordinate-inputs">{(['X', 'Y', 'Z'] as const).map((axis, index) => <label key={axis}><span>{axis}<small>m</small></span><CoordinateInput key={`${expandKey}:1:${axis}:${joint.linked}`} disabled={joint.linked} value={joint.endpoints[1].coordinate[index]} label={`${joint.label} ${joint.endpoints[1].label} ${axis}`} onCommit={v => changeIndividual(i => updateCoordinate(i, joint.id, 1, index as 0 | 1 | 2, v))} /></label>)}</div><p className="input-hint">{joint.linked ? 'Copied automatically from the first set. Turn off linking to record a separated joint.' : 'Each bone end has its own position. Collapsing this section keeps both sets.'}</p></div> : <p className="input-hint">{joint.linked ? 'The second bone end uses the same coordinates. Expand to record a separated joint.' : 'Independent bone-end coordinates are saved. Expand to inspect or edit them.'}</p>}
              </>}
              <div className="joint-note"><div><Bone size={17} /><strong>Recorded by bone</strong></div><p>{joint.endpoints.length > 1 ? 'Each coordinate set belongs to its contributing bone, so a missing bone never becomes an assumed connection.' : 'This landmark has one coordinate set. Proximal skull, fingers and toes do not need a second endpoint.'}</p></div>
              <div className="section-rule" />
              <div className="related-heading">CONTRIBUTING BONES <button onClick={() => setInspectorTab('inventory')}>View all <ChevronRight size={12} /></button></div>
              {joint.endpoints.map(endpoint => { const bone = selected.bones.find(b => b.id === endpoint.boneId); return bone && <div className="related-bone" key={endpoint.boneId}><Bone size={15} /><span>{bone.label}</span><span className={`bone-state ${bone.status}`}>{bone.status === 'unrecorded' ? 'Not recorded' : bone.status}</span></div>; })}
            </> : <>
              <div className="inventory-intro"><h3>Bone presence</h3><p>Presence is recorded separately. Empty coordinates never mean a bone is absent.</p></div>
              <div className="inventory-summary"><span><i className="present-dot" />{selected.bones.filter(b => b.status === 'present').length} present</span><span><i className="absent-dot" />{missingCount} absent</span><span>{unrecordedCount} unrecorded</span></div>
              <div className="inventory-list">{selected.bones.map(bone => <div className="inventory-row" key={bone.id}><div><Bone size={14} /><span>{bone.label}</span></div><select aria-label={`${bone.label} presence`} value={bone.status} className={`status-select ${bone.status}`} onChange={e => changeIndividual(i => setBoneStatus(i, bone.id, e.target.value as BoneStatus))}><option value="present">Present</option><option value="absent">Absent</option><option value="unrecorded">Unrecorded</option></select></div>)}</div>
              <p className="input-hint">Only present bones with complete required coordinates are drawn. Optional pelvis landmarks do not remove the pelvis.</p>
            </>}
          </div>
          <div className="inspector-bottom"><button className="notes-button" onClick={() => setModal('notes')}><MoreHorizontal size={17} /> Individual notes <span>{selected.notes ? 'Recorded' : 'Add note'}</span></button><div className="scenario-picker"><div className="eyebrow">EXAMPLE COORDINATES</div><button className="scenario-button" onClick={() => setScenarioMenu(v => !v)} aria-expanded={scenarioMenu}><RotateCcw size={15} /> Load a demo scenario <ChevronDown size={15} /></button>{scenarioMenu && <div className="scenario-menu"><button onClick={() => { setPendingProject(createDemoProject()); setScenarioMenu(false); setModal('import'); }}><strong>Open sample workspace</strong><span>Explicitly load two skeletons with example coordinates.</span></button>{SCENARIOS.map(s => <button key={s.id} onClick={() => loadScenario(s.id)}><strong>{s.label}</strong><span>{s.detail}</span></button>)}<p>Updates the left knee and femur/lower-leg inventory. Other observations stay unchanged.</p></div>}</div></div>
        </aside>
      </main>

      <footer className="app-footer"><span title={offlineError}><span className={`status-dot ${offlineReady ? 'ready' : ''}`} />{offlineReady ? 'Ready to work offline' : offlineError ? 'Offline setup needs attention · see notification' : import.meta.env.DEV ? 'Development preview · offline installation available in production build' : 'Preparing offline workspace…'}</span><span>UWA <i /> CITS3200 · TEAM 15 <i /> DESKTOP PROTOTYPE 0.1</span></footer>
    </div>
    <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" aria-label="Import JSON workspace" onChange={e => { const file = e.target.files?.[0]; if (file) void importFile(file); e.currentTarget.value = ''; }} />
    {toast && <div className={`toast ${saveState === 'error' ? 'error-toast' : ''}`} role="status"><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16} /></button></div>}

    {modal && <Modal title={modal === 'help' ? 'Workspace guide' : modal === 'export' ? 'Take your work with you.' : modal === 'add' ? 'Add an individual' : modal === 'notes' ? `${selected.name} · notes` : 'Open this workspace?'} onClose={() => setModal(null)}>
      {modal === 'help' && <><div className="modal-eyebrow">OSTEO / DESKTOP PROTOTYPE</div><p>A working prototype based on Ambika’s coordinate and offline requirements, with a shared view for the team’s multi-skeleton workflow.</p><div className="guide-steps"><div><span>01</span><p><strong>Start with your coordinates</strong>The workspace opens empty. Enter landmarks to reveal anatomical bone pieces, or explicitly open the sample workspace from the example menu.</p></div><div><span>02</span><p><strong>Inspect a joint</strong>Select a point or table row. Expand its second coordinate set and turn off linking to edit the bone ends separately.</p></div><div><span>03</span><p><strong>Try the three scenarios</strong>Load an articulated joint, a separated left knee, or a missing left femur. The lower leg stays present.</p></div><div><span>04</span><p><strong>Save, close, reopen</strong>Edits save on this browser. Export JSON for a restorable backup; CSV provides a bone-specific coordinate table.</p></div></div><div className="modal-note"><strong>About this prototype</strong><p>The same anatomical GLB asset and piece-positioning code as the mobile app, with bone-owned endpoints. Forearm and lower-leg inventory remains grouped. This is a workflow demonstration; anatomical mappings need review. Legacy numbered CSV import and real Windows installation are not yet validated.</p></div><button className="button primary wide" onClick={async () => { if (installEvent) { await installEvent.prompt(); await installEvent.userChoice; setInstallEvent(null); } else notify(offlineReady ? 'In Windows Edge, use the app installation icon in the address bar to install OSTEO.' : 'Installation requires the production preview or an HTTPS deployment. See desktop/README.md.'); }}> <ArrowDownToLine size={16} /> {installEvent ? 'Install desktop app' : 'Installation information'}</button></>}
      {modal === 'export' && <><p>Keep both coordinate sets, bone inventory and notes in a portable backup.</p><button className="export-choice" onClick={exportJson}><FileJson size={26} /><div><strong>Workspace file <span>RECOMMENDED</span></strong><p>JSON · reopen and continue editing in OSTEO</p></div><ArrowDownToLine size={18} /></button><button className="export-choice" onClick={exportCsv}><Table2 size={26} /><div><strong>Coordinate table</strong><p>CSV · one row per bone-owned endpoint</p></div><ArrowDownToLine size={18} /></button><p className="input-hint">CSV is for analysis and sharing. Use the workspace file to restore your full project.</p></>}
      {modal === 'add' && <form onSubmit={e => { e.preventDefault(); addIndividual(); }}><p>Start with empty coordinates. Bones are initially marked present, as in the mobile recorder.</p><label className="modal-field">Body / individual ID<input autoFocus required maxLength={80} placeholder="e.g. IND-003" value={newName} onChange={e => setNewName(e.target.value)} /></label><label className="modal-field">Accession number<input required maxLength={80} placeholder="e.g. BP002" value={newAccession} onChange={e => setNewAccession(e.target.value)} /></label><button className="button primary wide" type="submit"><Plus size={16} /> Create individual</button></form>}
      {modal === 'import' && pendingProject && <><p><strong>{pendingProject.name}</strong> contains {pendingProject.individuals.length} individuals. Opening it will replace the current workspace saved on this device.</p><div className="modal-note">Export your current workspace first if you want to keep it.</div><div className="button-row"><button className="button" onClick={exportJson}>Export current</button><button className="button primary" onClick={() => { setProject(pendingProject); setSelectedId(pendingProject.individuals[0].id); setJointId('left_knee'); setExpanded({}); setStorageBlocked(false); setModal(null); setFrameKey(n => n + 1); notify('Workspace imported and saved on this device.'); }}>Open workspace</button></div></>}
      {modal === 'notes' && <><p>Notes are saved with this individual and included in workspace exports.</p><textarea className="notes-textarea" autoFocus aria-label="Individual notes" maxLength={10000} placeholder="Record context, observations or questions for review…" value={selected.notes} onChange={e => changeIndividual(i => ({ ...i, notes: e.target.value }))} /><button className="button primary wide" onClick={() => setModal(null)}><Check size={16} /> Done</button></>}
    </Modal>}
  </div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const el = ref.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex="0"]') ?? []).filter(n => !n.hasAttribute('disabled'));
    const input = el?.querySelector<HTMLElement>('[autofocus],input,textarea'); (input ?? focusables()[0])?.focus();
    const trap = (e: KeyboardEvent) => { if (e.key !== 'Tab') return; const items = focusables(); const first = items[0]; const last = items[items.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } };
    el?.addEventListener('keydown', trap); return () => { el?.removeEventListener('keydown', trap); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal" ref={ref} role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close icon-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button><h2 id="modal-title">{title}</h2>{children}</div></div>;
}

import { useEffect, useRef, useState } from "react";
import { CoordinateInput } from "./CoordinateInput";
import { Ban, Check, Download, Pencil, Plus, RotateCcw, Save, Upload, X } from "lucide-react";
import { ALL_CFA_POINTS, CFA_GROUPS, pointLabel, type PointGroupId, type PointName } from "../data/cfaSchema";
import type { BackendConnectionState } from "../lib/backendApi";
import type { SkeletonRecord, WorkspaceGraveyard } from "../types";

interface CoordinatePanelProps {
  records: SkeletonRecord[];
  activeRecord: SkeletonRecord;
  graveyards: WorkspaceGraveyard[];
  selectedGraveyardId?: string;
  onSelectGraveyard: (graveyardId: string) => void;
  onCreateGraveyard: () => void;
  onRenameGraveyard: (name: string) => void;
  onSelectRecord: (recordId: string) => void;
  onCreateRecord: () => void;
  onRenameRecord: (name: string) => void;
  onCoordinateChange: (point: PointName, axis: 0 | 1 | 2, value: number | null) => void;
  onGroupPresenceChange: (groupId: PointGroupId, present: boolean) => void;
  onResetCoordinates: () => void;
  onImportCsv: (file: File) => void;
  onExportRecord: () => void;
  onSave: () => void;
  onLoadFromBackend: () => void;
  backendStatus: BackendConnectionState;
  canExport: boolean;
}

function isComplete(record: SkeletonRecord, point: PointName): boolean {
  const coordinate = record.coordinates[point];
  return Boolean(coordinate?.every((value) => value !== null && Number.isFinite(value)));
}

export function CoordinatePanel({ 
  records, 
  activeRecord, 
  graveyards, 
  selectedGraveyardId,
  onSelectGraveyard,
  onCreateGraveyard,
  onRenameGraveyard,
  onSelectRecord,
  onCreateRecord,
  onRenameRecord,
  onCoordinateChange,
  onGroupPresenceChange,
  onResetCoordinates,
  onImportCsv,
  onExportRecord,
  onSave,
  backendStatus,
  canExport,
}: CoordinatePanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const fullViewportHeightRef = useRef(0);
  const [focusedCoordinate, setFocusedCoordinate] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [isRenamingGraveyard, setIsRenamingGraveyard] = useState(false);
  const [graveyardNameDraft, setGraveyardNameDraft] = useState("");
  const [isRenamingRecord, setIsRenamingRecord] = useState(false);
  const [recordNameDraft, setRecordNameDraft] = useState("");
  
  const selectedGraveyard = graveyards.find((graveyard) => graveyard.id === selectedGraveyardId);

  const startRenamingGraveyard = () => {
    setGraveyardNameDraft(selectedGraveyard?.name ?? "");
    setIsRenamingGraveyard(true);
  };

  const cancelRenamingGraveyard = () => {
    setGraveyardNameDraft(selectedGraveyard?.name ?? "");
    setIsRenamingGraveyard(false);
  };

  const saveGraveyardName = () => {
    const name = graveyardNameDraft.trim();
    if (!name) return;
    onRenameGraveyard(name);
    setIsRenamingGraveyard(false);
  };

  const startRenamingRecord = () => {
    setRecordNameDraft(activeRecord.name);
    setIsRenamingRecord(true);
  };

  const cancelRenamingRecord = () => {
    setRecordNameDraft(activeRecord.name);
    setIsRenamingRecord(false);
  };

  const saveRecordName = () => {
    const name = recordNameDraft.trim();
    if (!name) return;
    onRenameRecord(name);
    setIsRenamingRecord(false);
  };

  useEffect(() => {
    const viewport = window.visualViewport;
    const viewportHeight = () => viewport?.height ?? window.innerHeight;
    fullViewportHeightRef.current = Math.max(fullViewportHeightRef.current, viewportHeight());

    if (!focusedCoordinate) {
      setKeyboardOpen(false);
      return;
    }

    const handleResize = () => {
      const currentHeight = viewportHeight();
      const isOpen = currentHeight < fullViewportHeightRef.current - 120;
      setKeyboardOpen(isOpen);
      if (!isOpen) fullViewportHeightRef.current = Math.max(fullViewportHeightRef.current, currentHeight);
    };

    viewport?.addEventListener("resize", handleResize);
    window.addEventListener("resize", handleResize);
    return () => {
      viewport?.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", handleResize);
    };
  }, [focusedCoordinate]);

  useEffect(() => {
    document.documentElement.classList.toggle("coordinate-keyboard-active", keyboardOpen);
    return () => document.documentElement.classList.remove("coordinate-keyboard-active");
  }, [keyboardOpen]);

  const focusCoordinate = (input: HTMLInputElement, label: string) => {
    setFocusedCoordinate(label);
    setKeyboardOpen(true);
    window.setTimeout(() => {
      input.closest(".coordinate-point-row")?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 250);
  };

  const handlePanelBlur = () => {
    window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      const isAnotherCoordinateInput = activeElement instanceof HTMLInputElement
        && panelRef.current?.contains(activeElement)
        && Boolean(activeElement.closest(".axis-inputs"));
      if (!isAnotherCoordinateInput) {
        setFocusedCoordinate(null);
        setKeyboardOpen(false);
      }
    });
  };

  const availablePoints = ALL_CFA_POINTS.filter((point) => {
    const group = CFA_GROUPS.find((candidate) => (candidate.points as readonly PointName[]).includes(point));
    return group ? !activeRecord.excludedGroups.includes(group.id) : true;
  });
  const completedPoints = availablePoints.filter((point) => isComplete(activeRecord, point)).length;

  return (
    <aside ref={panelRef} className="panel coordinate-panel" onBlurCapture={handlePanelBlur}>
      <div className="panel-heading coordinate-heading">
        <div>
          <p className="eyebrow">CFA DATA ENTRY</p>
          <h2>Skeleton coordinates</h2>
        </div>
        <span className="count-pill">{completedPoints}/{availablePoints.length}</span>
      </div>

      <div className="record-card">
        <div className="record-selector-row">
          <label>
            Graveyard
            {isRenamingGraveyard ? (
              <input
                className="inline-name-input"
                value={graveyardNameDraft}
                maxLength={255}
                aria-label="Graveyard name"
                autoFocus
                onChange={(event) => setGraveyardNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveGraveyardName();
                  if (event.key === "Escape") cancelRenamingGraveyard();
                }}
              />
            ) : (
              <select
                value={selectedGraveyardId ?? ""}
                onChange={(event) => onSelectGraveyard(event.target.value)}
              >
                {graveyards.map((graveyard) => (
                  <option key={graveyard.id} value={graveyard.id}>
                    {graveyard.name}
                  </option>
                ))}
              </select>
            )}
          </label>

          <div className="record-action">
            {isRenamingGraveyard ? (
              <>
                <button type="button" className="edit-name-button confirm" onClick={saveGraveyardName} disabled={!graveyardNameDraft.trim()} title="Save graveyard name" aria-label="Save graveyard name">
                  <Check size={16} />
                </button>
                <button type="button" className="edit-name-button" onClick={cancelRenamingGraveyard} title="Cancel renaming" aria-label="Cancel renaming">
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <button type="button" className="edit-name-button" onClick={startRenamingGraveyard} disabled={!selectedGraveyard} title="Rename graveyard" aria-label="Rename graveyard">
                  <Pencil size={15} />
                </button>
                <button type="button" className="new-record-button" onClick={onCreateGraveyard} title="Create graveyard">
                  <Plus size={16} /> New
                </button>
              </>
            )}
          </div>
        </div>

        <div className="record-selector-row">
          <label>
            Skeleton record
            {isRenamingRecord ? (
              <input
                className="inline-name-input"
                value={recordNameDraft}
                maxLength={80}
                aria-label="Skeleton record name"
                autoFocus
                onChange={(event) => setRecordNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveRecordName();
                  if (event.key === "Escape") cancelRenamingRecord();
                }}
              />
            ) : (
              <select
                value={activeRecord.id}
                onChange={(event) => onSelectRecord(event.target.value)}
              >
                {records.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.name}
                  </option>
                ))}
              </select>
            )}
          </label>

          <div className="record-action">
            {isRenamingRecord ? (
              <>
                <button type="button" className="edit-name-button confirm" onClick={saveRecordName} disabled={!recordNameDraft.trim()} title="Save skeleton record name" aria-label="Save skeleton record name">
                  <Check size={16} />
                </button>
                <button type="button" className="edit-name-button" onClick={cancelRenamingRecord} title="Cancel renaming" aria-label="Cancel renaming">
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <button type="button" className="edit-name-button" onClick={startRenamingRecord} title="Rename skeleton record" aria-label="Rename skeleton record">
                  <Pencil size={15} />
                </button>
                <button type="button" className="new-record-button" onClick={onCreateRecord} title="Create skeleton record">
                  <Plus size={16} /> New
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="coordinate-focus-banner" role="status" aria-live="polite">
        <span>Editing coordinate</span>
        <strong>{focusedCoordinate}</strong>
      </div>

      <div className="coordinate-scroll-area">
        {CFA_GROUPS.map((group) => {
          const present = !activeRecord.excludedGroups.includes(group.id);
          return (
            <section className={`coordinate-group ${present ? "" : "excluded"}`} key={group.id}>
              <div className="coordinate-group-heading">
                <div>
                  <strong>{group.label}</strong>
                  <small>{group.points.length} LANDMARKS</small>
                </div>
                <button
                  type="button"
                  className={present ? "present" : "absent"}
                  aria-pressed={present}
                  onClick={() => onGroupPresenceChange(group.id, !present)}
                >
                  {present ? <Check size={13} /> : <Ban size={13} />}
                  {present ? "Present" : "Not present"}
                </button>
              </div>

              {present ? (
                <div className="coordinate-point-list">
                  {group.points.map((point) => {
                    const coordinate = activeRecord.coordinates[point] ?? [null, null, null];
                    const complete = isComplete(activeRecord, point);
                    return (
                      <div className={`coordinate-point-row ${complete ? "complete" : ""}`} key={point}>
                        <div className="coordinate-point-name">
                          <span>{complete ? <Check size={11} /> : null}</span>
                          <strong>{pointLabel(point)}</strong>
                        </div>
                        <div className="axis-inputs">
                          {(["X", "Y", "Z"] as const).map((axisLabel, axis) => (
                              <CoordinateInput
                                key={`${activeRecord.id}:${point}:${axis}`}
                                axis={axisLabel}
                                label={`${pointLabel(point)} ${axisLabel}`}
                                value={coordinate[axis] ?? null}
                                onFocus={(input) => focusCoordinate(
                                  input,
                                  `${group.label} · ${pointLabel(point)} · ${axisLabel}`,
                                )}
                                onChange={(value) => onCoordinateChange(point, axis as 0 | 1 | 2, value)}
                              />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="excluded-group-copy">This anatomical group will be omitted from backend output.</p>
              )}
            </section>
          );
        })}

        <button type="button" className="reset-coordinates-button" onClick={onResetCoordinates}>
          <RotateCcw size={14} /> Reset coordinates for this record
        </button>
      </div>

      <div className="coordinate-action-bar" aria-label="Coordinate record actions">
        <input
          ref={csvInputRef}
          className="coordinate-csv-input"
          type="file"
          accept=".csv,text/csv"
          aria-label="Import coordinate CSV"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onImportCsv(file);
            event.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          className="coordinate-footer-button import"
          onClick={() => csvInputRef.current?.click()}
          title="Import skeleton coordinates from CSV"
        >
          <Upload size={16} /> Import CSV
        </button>
        <button
          type="button"
          className="coordinate-footer-button export"
          onClick={onExportRecord}
          disabled={!canExport}
          title={canExport ? "Export backend-ready CSV" : "Complete at least one coordinate before exporting"}
        >
          <Download size={16} /> Export CSV
        </button>
        <button type="button" className="coordinate-footer-button save" onClick={onSave} disabled={backendStatus === "syncing"}>
          <Save size={16} /> {backendStatus === "syncing" ? "Syncing…" : "Save & sync"}
        </button>
      </div>
    </aside>
  );
}

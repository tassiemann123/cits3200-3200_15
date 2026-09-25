import { useEffect, useRef, useState } from "react";
import { CoordinateInput } from "./CoordinateInput";
import { Ban, Check, CloudDownload, Download, Plus, RotateCcw, Save, Upload } from "lucide-react";
import { ALL_CFA_POINTS, boneLabelsFor, CFA_GROUPS, groupForBone, pointLabel, type PointGroupId, type PointName } from "../data/cfaSchema";
import type { BackendConnectionState } from "../lib/backendApi";
import type { CoordinateDraft, SkeletonRecord, WorkspaceGraveyard } from "../types";

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
  onCoordinateChange: (point: PointName, boneIndex: number, axis: 0 | 1 | 2, value: number | null) => void;
  onBonePresenceChange: (point: PointName, boneIndex: number, present: boolean) => void;
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

/**
 * The coordinate for one contributing bone at a joint. Bone 0 is always
 * record.coordinates[point] -- the same value isComplete() above checks,
 * unchanged by the multi-bone feature. A bone above 0 mirrors bone 0
 * until it's been edited independently (auto-duplicate), at which point
 * it's read from extraBoneCoordinates instead.
 */
function boneCoordinate(record: SkeletonRecord, point: PointName, boneIndex: number): CoordinateDraft {
  if (boneIndex === 0) return record.coordinates[point] ?? [null, null, null];
  return record.extraBoneCoordinates?.[point]?.[boneIndex - 1] ?? record.coordinates[point] ?? [null, null, null];
}

function isBonePresent(record: SkeletonRecord, point: PointName, boneIndex: number): boolean {
  return !(record.excludedBones ?? []).includes(`${point}:${boneIndex}`);
}

function isBoneComplete(record: SkeletonRecord, point: PointName, boneIndex: number): boolean {
  if (!isBonePresent(record, point, boneIndex)) return true;
  return boneCoordinate(record, point, boneIndex).every((value) => value !== null && Number.isFinite(value));
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
  onBonePresenceChange,
  onGroupPresenceChange,
  onResetCoordinates,
  onImportCsv,
  onExportRecord,
  onSave,
  onLoadFromBackend,
  backendStatus,
  canExport,
}: CoordinatePanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const fullViewportHeightRef = useRef(0);
  const [focusedCoordinate, setFocusedCoordinate] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  
  const selectedGraveyard = graveyards.find((graveyard) => graveyard.id === selectedGraveyardId);

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

  /**
   * One contributing bone's presence toggle + (if present) its X/Y/Z
   * inputs. Shared by a multi-bone point's normal render and by the
   * "escaped" render below, so a bone governed by a different group than
   * the one it's displayed under (see groupForBone in cfaSchema.ts --
   * currently just each acetabulum's "Thigh (proximal)" bone) renders
   * identically either way, just outside its usual group's point list.
   */
  const renderBoneRow = (group: { label: string }, point: PointName, boneLabel: string, boneIndex: number) => {
    const bonePresent = isBonePresent(activeRecord, point, boneIndex);
    const coordinate = boneCoordinate(activeRecord, point, boneIndex);
    return (
      <div className={`coordinate-bone-row ${bonePresent ? "" : "absent"}`} key={`${point}:${boneIndex}`}>
        <div className="coordinate-bone-heading">
          <span>{boneLabel}</span>
          <button
            type="button"
            className={bonePresent ? "present" : "absent"}
            aria-pressed={bonePresent}
            onClick={() => onBonePresenceChange(point, boneIndex, !bonePresent)}
          >
            {bonePresent ? <Check size={11} /> : <Ban size={11} />}
            {bonePresent ? "Present" : "Not present"}
          </button>
        </div>
        {bonePresent && (
          <div className="axis-inputs">
            {(["X", "Y", "Z"] as const).map((axisLabel, axis) => (
                <CoordinateInput
                  key={`${activeRecord.id}:${point}:${boneIndex}:${axis}`}
                  axis={axisLabel}
                  label={`${pointLabel(point)} · ${boneLabel} ${axisLabel}`}
                  value={coordinate[axis] ?? null}
                  onFocus={(input) => focusCoordinate(
                    input,
                    `${group.label} · ${pointLabel(point)} · ${boneLabel} · ${axisLabel}`,
                  )}
                  onChange={(value) => onCoordinateChange(point, boneIndex, axis as 0 | 1 | 2, value)}
                />
            ))}
          </div>
        )}
      </div>
    );
  };

  const availablePoints = ALL_CFA_POINTS.filter((point) => {
    const group = CFA_GROUPS.find((candidate) => (candidate.points as readonly PointName[]).includes(point));
    return group ? !activeRecord.excludedGroups.includes(group.id) : true;
  });
  const completedPoints = availablePoints.filter((point) => isComplete(activeRecord, point)).length;
  const completion = availablePoints.length === 0 ? 0 : Math.round((completedPoints / availablePoints.length) * 100);
  const backendRecordLabel = activeRecord.backendId
    ? "Linked to backend"
    : backendStatus === "online"
      ? "Backend ready · not synced yet"
      : backendStatus === "syncing"
        ? "Syncing backend…"
        : backendStatus === "checking"
          ? "Checking backend…"
          : "Offline · saved locally";

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
          </label>

          <button
            type="button"
            className="new-record-button"
            onClick={onCreateGraveyard}
            title="Create graveyard"
          >
            <Plus size={16} /> New
          </button>
        </div>

        <label className="record-name-field">
          Graveyard name
          <input
            value={selectedGraveyard?.name ?? ""}
            maxLength={255}
            placeholder="Untitled graveyard"
            onChange={(event) => onRenameGraveyard(event.target.value)}
          />
        </label>

        <div className="record-selector-row">
          <label>
            Skeleton record
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
          </label>

          <button
            type="button"
            className="new-record-button"
            onClick={onCreateRecord}
            title="Create skeleton record"
          >
            <Plus size={16} /> New
          </button>
        </div>
        <label className="record-name-field">
          Record name
          <input
            value={activeRecord.name}
            maxLength={80}
            placeholder="Untitled skeleton"
            onChange={(event) => onRenameRecord(event.target.value)}
            onBlur={(event) => onRenameRecord(event.target.value.trim() || "Untitled skeleton")}
          />
        </label>
        <div className="backend-record-row">
          <span className={activeRecord.backendId || backendStatus === "online" ? "linked" : "local"}>
            {backendRecordLabel}
          </span>
          <button type="button" onClick={onLoadFromBackend} disabled={backendStatus === "syncing"}>
            <CloudDownload size={13} /> {backendStatus === "syncing" ? "Syncing…" : "Load backend"}
          </button>
        </div>
        <div className="coordinate-progress" aria-label={`${completion}% complete`}>
          <span style={{ width: `${completion}%` }} />
        </div>
        <p>{completion}% complete · only complete X, Y, Z points are backend-ready</p>
      </div>

      <div className="coordinate-focus-banner" role="status" aria-live="polite">
        <span>Editing coordinate</span>
        <strong>{focusedCoordinate}</strong>
      </div>

      <div className="coordinate-scroll-area">
        {CFA_GROUPS.map((group) => {
          const present = !activeRecord.excludedGroups.includes(group.id);

          // Bones inside this group's own points that are actually
          // governed by a DIFFERENT group's presence toggle (see
          // groupForBone in cfaSchema.ts) -- currently just each
          // acetabulum's "Thigh (proximal)" bone, filed here under the
          // pelvis for display but governed by the leg's own presence.
          // These keep showing, and stay independently editable, even
          // while this group itself is marked not present -- marking the
          // pelvis absent is a statement about the hip bone, not the femur.
          const escapedBones = group.points.flatMap((point) => {
            const boneLabels = boneLabelsFor(point);
            if (!boneLabels) return [];
            return boneLabels
              .map((boneLabel, boneIndex) => ({ point, boneLabel, boneIndex, ownerGroupId: groupForBone(point, boneIndex) }))
              .filter((entry) => entry.ownerGroupId !== group.id);
          });

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
                    const boneLabels = boneLabelsFor(point);
                    const complete = isComplete(activeRecord, point);

                    if (!boneLabels) {
                      const coordinate = activeRecord.coordinates[point] ?? [null, null, null];
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
                                  onChange={(value) => onCoordinateChange(point, 0, axis as 0 | 1 | 2, value)}
                                />
                            ))}
                          </div>
                        </div>
                      );
                    }

                    // Multi-bone joint: one X/Y/Z row per contributing bone.
                    // A bone that hasn't been edited independently mirrors
                    // bone 0's value (auto-duplicate) until it's changed.
                    const allBonesComplete = boneLabels.every((_, boneIndex) => isBoneComplete(activeRecord, point, boneIndex));
                    return (
                      <div className={`coordinate-point-row multi-bone ${allBonesComplete ? "complete" : ""}`} key={point}>
                        <div className="coordinate-point-name">
                          <span>{allBonesComplete ? <Check size={11} /> : null}</span>
                          <strong>{pointLabel(point)}</strong>
                          <small className="bone-count-pill">{boneLabels.length} bones</small>
                        </div>
                        {boneLabels.map((boneLabel, boneIndex) => renderBoneRow(group, point, boneLabel, boneIndex))}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  <p className="excluded-group-copy">This anatomical group will be omitted from backend output.</p>
                  {escapedBones.length > 0 && (
                    <div className="coordinate-point-list">
                      {escapedBones.map(({ point, boneLabel, boneIndex, ownerGroupId }) => (
                        <div className="coordinate-point-row multi-bone" key={`${point}:${boneIndex}`}>
                          <div className="coordinate-point-name">
                            <strong>{pointLabel(point)}</strong>
                            <small className="bone-count-pill">
                              tracks with {CFA_GROUPS.find((candidate) => candidate.id === ownerGroupId)?.label ?? ownerGroupId}
                            </small>
                          </div>
                          {renderBoneRow(group, point, boneLabel, boneIndex)}
                        </div>
                      ))}
                    </div>
                  )}
                </>
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

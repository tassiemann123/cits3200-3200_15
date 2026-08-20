import { useRef } from "react";
import { Ban, Check, Download, Plus, RotateCcw, Save, Upload } from "lucide-react";
import { ALL_CFA_POINTS, CFA_GROUPS, pointLabel, type PointGroupId, type PointName } from "../data/cfaSchema";
import type { SkeletonRecord } from "../types";

interface CoordinatePanelProps {
  records: SkeletonRecord[];
  activeRecord: SkeletonRecord;
  onSelectRecord: (recordId: string) => void;
  onCreateRecord: () => void;
  onRenameRecord: (name: string) => void;
  onCoordinateChange: (point: PointName, axis: 0 | 1 | 2, value: number | null) => void;
  onGroupPresenceChange: (groupId: PointGroupId, present: boolean) => void;
  onResetCoordinates: () => void;
  onImportCsv: (file: File) => void;
  onExportRecord: () => void;
  onSave: () => void;
  canExport: boolean;
}

function isComplete(record: SkeletonRecord, point: PointName): boolean {
  const coordinate = record.coordinates[point];
  return Boolean(coordinate?.every((value) => value !== null && Number.isFinite(value)));
}

export function CoordinatePanel({
  records,
  activeRecord,
  onSelectRecord,
  onCreateRecord,
  onRenameRecord,
  onCoordinateChange,
  onGroupPresenceChange,
  onResetCoordinates,
  onImportCsv,
  onExportRecord,
  onSave,
  canExport,
}: CoordinatePanelProps) {
  const csvInputRef = useRef<HTMLInputElement>(null);
  const availablePoints = ALL_CFA_POINTS.filter((point) => {
    const group = CFA_GROUPS.find((candidate) => (candidate.points as readonly PointName[]).includes(point));
    return group ? !activeRecord.excludedGroups.includes(group.id) : true;
  });
  const completedPoints = availablePoints.filter((point) => isComplete(activeRecord, point)).length;
  const completion = availablePoints.length === 0 ? 0 : Math.round((completedPoints / availablePoints.length) * 100);

  return (
    <aside className="panel coordinate-panel">
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
            Skeleton record
            <select value={activeRecord.id} onChange={(event) => onSelectRecord(event.target.value)}>
              {records.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}
            </select>
          </label>
          <button type="button" className="new-record-button" onClick={onCreateRecord} title="Create skeleton record">
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
        <div className="coordinate-progress" aria-label={`${completion}% complete`}>
          <span style={{ width: `${completion}%` }} />
        </div>
        <p>{completion}% complete · only complete X, Y, Z points are backend-ready</p>
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
                            <label key={axisLabel}>
                              <span>{axisLabel}</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                step="any"
                                aria-label={`${pointLabel(point)} ${axisLabel}`}
                                value={coordinate[axis] ?? ""}
                                onChange={(event) => {
                                  const rawValue = event.target.value;
                                  const value = rawValue === "" ? null : Number(rawValue);
                                  onCoordinateChange(point, axis as 0 | 1 | 2, Number.isFinite(value) ? value : null);
                                }}
                              />
                            </label>
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
        <button type="button" className="coordinate-footer-button save" onClick={onSave}>
          <Save size={16} /> Save locally
        </button>
      </div>
    </aside>
  );
}

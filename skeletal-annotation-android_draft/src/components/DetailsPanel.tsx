import { Database, Download, Info, RotateCcw, Upload } from "lucide-react";
import type { Landmark, ViewerModel } from "../types";

interface DetailsPanelProps {
  model: ViewerModel;
  recordName: string;
  coordinates: Landmark[];
  notes: string;
  isInitialModel: boolean;
  onImportClick: () => void;
  onResetModel: () => void;
  onExportRecord: () => void;
  onNotesChange: (notes: string) => void;
}

function formatCoordinate(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : "—";
}

export function DetailsPanel({ model, recordName, coordinates, notes, isInitialModel, onImportClick, onResetModel, onExportRecord, onNotesChange }: DetailsPanelProps) {
  return (
    <aside className="panel details-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">ACTIVE SKELETON RECORD</p>
          <h2>{recordName}</h2>
        </div>
      </div>

      <label className="field-label">
        Reference model
        <input value={model.name} readOnly />
      </label>

      <div className="project-action-stack">
        <button type="button" className="model-import-button" onClick={onImportClick}>
          <Upload size={16} />
          <span><strong>Switch reference model</strong><small>Choose a compatible GLB from this device</small></span>
        </button>
        <button type="button" className="model-reset-button" onClick={onResetModel} disabled={isInitialModel}>
          <RotateCcw size={15} />
          <span><strong>Reset reference model</strong><small>{isInitialModel ? "Bundled model is active" : "Restore the original bundled skeleton"}</small></span>
        </button>
      </div>

      <div className="research-note">
        <Info size={16} />
        <p>Changing the reference model does not replace or delete the coordinate records. Imported GLB files remain local to this session.</p>
      </div>
      <p className="model-attribution">{model.attribution}</p>

      <label className="field-label notes-field">
        Research notes
        <textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="Record observations, comparison notes, or model limitations…" />
      </label>

      <section className="backend-coordinate-section" aria-labelledby="backend-coordinate-title">
        <div className="section-title">
          <span id="backend-coordinate-title">Backend-ready coordinates</span>
          <div className="section-title-actions">
            <small>{coordinates.length > 0 ? `${coordinates.length} COMPLETE` : "NO COMPLETE POINTS"}</small>
            <button
              type="button"
              className="coordinate-export-button"
              onClick={onExportRecord}
              disabled={coordinates.length === 0}
              title={coordinates.length === 0 ? "Complete at least one coordinate before exporting" : "Export backend-ready JSON"}
            >
              <Download size={13} /> JSON
            </button>
          </div>
        </div>
        {coordinates.length > 0 ? (
          <div className="backend-coordinate-table-wrap">
            <table className="backend-coordinate-table">
              <thead><tr><th>Point</th><th>X</th><th>Y</th><th>Z</th></tr></thead>
              <tbody>
                {coordinates.map((coordinate) => (
                  <tr key={coordinate.id}>
                    <td title={coordinate.label}>{coordinate.label}</td>
                    <td>{formatCoordinate(coordinate.position[0])}</td>
                    <td>{formatCoordinate(coordinate.position[1])}</td>
                    <td>{formatCoordinate(coordinate.position[2])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="coordinate-empty-state">
            <Database size={19} />
            <div>
              <strong>No complete coordinates yet</strong>
              <p>Enter X, Y and Z values in Coordinates. Complete, present points will appear here for backend integration.</p>
            </div>
          </div>
        )}
      </section>
    </aside>
  );
}

import { Database, Info, RotateCcw, Upload } from "lucide-react";
import type { Landmark, ViewerModel } from "../types";

interface DetailsPanelProps {
  model: ViewerModel;
  coordinates: Landmark[];
  notes: string;
  isInitialProject: boolean;
  onImportClick: () => void;
  onResetProject: () => void;
  onNotesChange: (notes: string) => void;
}

function formatCoordinate(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : "—";
}

export function DetailsPanel({ model, coordinates, notes, isInitialProject, onImportClick, onResetProject, onNotesChange }: DetailsPanelProps) {
  return (
    <aside className="panel details-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">ACTIVE PROJECT</p>
          <h2>{model.name}</h2>
        </div>
      </div>

      <label className="field-label">
        Project model
        <input value={model.name} readOnly />
      </label>

      <div className="project-action-stack">
        <button type="button" className="model-import-button" onClick={onImportClick}>
          <Upload size={16} />
          <span><strong>Switch to another project</strong><small>Choose a project GLB from this device</small></span>
        </button>
        <button type="button" className="model-reset-button" onClick={onResetProject} disabled={isInitialProject}>
          <RotateCcw size={15} />
          <span><strong>Reset to default project</strong><small>{isInitialProject ? "Default project is active" : "Restore the original bundled skeleton"}</small></span>
        </button>
      </div>

      <div className="research-note">
        <Info size={16} />
        <p>The default project is always available. Other project files remain local to this session and can be reset safely at any time.</p>
      </div>
      <p className="model-attribution">{model.attribution}</p>

      <label className="field-label notes-field">
        Research notes
        <textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="Record observations, comparison notes, or model limitations…" />
      </label>

      <section className="backend-coordinate-section" aria-labelledby="backend-coordinate-title">
        <div className="section-title">
          <span id="backend-coordinate-title">Backend coordinates</span>
          <small>{coordinates.length > 0 ? `${coordinates.length} POINTS` : "BACKEND DATA"}</small>
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
              <strong>Waiting for backend coordinates</strong>
              <p>Point labels and X, Y, Z values returned by the backend will appear here.</p>
            </div>
          </div>
        )}
      </section>
    </aside>
  );
}

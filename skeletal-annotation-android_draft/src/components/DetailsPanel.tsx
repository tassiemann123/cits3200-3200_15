import { Database, Info, Upload } from "lucide-react";
import type { Landmark, ViewerModel } from "../types";

interface DetailsPanelProps {
  model: ViewerModel;
  coordinates: Landmark[];
  notes: string;
  onImportClick: () => void;
  onNotesChange: (notes: string) => void;
}

function formatCoordinate(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : "—";
}

export function DetailsPanel({ model, coordinates, notes, onImportClick, onNotesChange }: DetailsPanelProps) {
  return (
    <aside className="panel details-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SELECTED MODEL</p>
          <h2>{model.name}</h2>
        </div>
      </div>

      <label className="field-label">
        Model name
        <input value={model.name} readOnly />
      </label>

      <button type="button" className="model-import-button" onClick={onImportClick}>
        <Upload size={16} />
        <span><strong>Replace model</strong><small>Choose a GLB file from this device</small></span>
      </button>

      <div className="research-note">
        <Info size={16} />
        <p>This is a visual reference model. Imported files are kept locally for this session and are displayed at a normalised viewing size.</p>
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

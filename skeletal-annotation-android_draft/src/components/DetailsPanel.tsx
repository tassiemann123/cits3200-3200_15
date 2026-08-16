import { Bone, CircleDot, Info, Minus, Trash2 } from "lucide-react";
import type { ModelType, SkeletonLayer } from "../types";

interface DetailsPanelProps {
  layer: SkeletonLayer | null;
  onPatch: (id: string, patch: Partial<SkeletonLayer>) => void;
  onRemove: (id: string) => void;
}

export function DetailsPanel({ layer, onPatch, onRemove }: DetailsPanelProps) {
  if (!layer) {
    return (
      <aside className="panel details-panel empty-details">
        <CircleDot size={30} />
        <h2>Select an individual</h2>
        <p>Select a skeleton in the layer list or viewport to view its landmarks and model settings.</p>
      </aside>
    );
  }

  const modelType = layer.modelType;
  return (
    <aside className="panel details-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SELECTED RECORD</p>
          <h2>{layer.name}</h2>
        </div>
        <span className="color-chip" style={{ background: layer.color }} />
      </div>

      <label className="field-label">
        Individual name
        <input value={layer.name} onChange={(event) => onPatch(layer.id, { name: event.target.value })} disabled={layer.locked} />
      </label>

      <div className="field-label">
        Model display
        <div className="segmented-control">
          {([
            ["landmarks", "Landmarks"],
            ["male", "Male"],
            ["female", "Female"],
          ] as Array<[ModelType, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={modelType === value ? "selected" : ""}
              onClick={() => onPatch(layer.id, { modelType: value })}
              disabled={layer.locked && value !== "landmarks"}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="field-label color-field">
        Layer colour
        <span>
          <input type="color" value={layer.color} onChange={(event) => onPatch(layer.id, { color: event.target.value.toUpperCase() })} />
          <code>{layer.color.toUpperCase()}</code>
        </span>
      </label>

      <div className="metric-grid">
        <div><CircleDot size={17} /><span><strong>{layer.landmarks.length}</strong>landmarks</span></div>
        <div><Minus size={17} /><span><strong>{layer.segments.length}</strong>segments</span></div>
        <div><Bone size={17} /><span><strong>{modelType === "female" ? "118" : modelType === "male" ? "18" : "—"}</strong>{modelType === "female" ? "joints" : modelType === "male" ? "bones" : "model"}</span></div>
        <div><Info size={17} /><span><strong>{layer.visible ? "Shown" : "Hidden"}</strong>status</span></div>
      </div>

      {modelType !== "landmarks" && (
        <>
          <div className="research-note">
            <Info size={16} />
            <p>The reference model is fitted to the landmark range, direction, and scale. It is not yet a research-grade joint pose registration.</p>
          </div>
          <p className="model-attribution">
            {modelType === "female"
              ? "Female Skeleton · projectkaizen · CC BY 4.0"
              : "Skeleton Pre-cut · Maxime66410 · Sketchfab Standard"}
          </p>
        </>
      )}

      <label className="field-label notes-field">
        Research notes
        <textarea value={layer.notes} onChange={(event) => onPatch(layer.id, { notes: event.target.value })} placeholder="Record observations, context, or anomalies…" />
      </label>

      <div className="coordinate-table-wrap">
        <div className="section-title"><span>Landmark preview</span><small>X / Z / Y</small></div>
        <table className="coordinate-table">
          <thead><tr><th>Point</th><th>X</th><th>Z</th><th>Y</th></tr></thead>
          <tbody>
            {layer.landmarks.slice(0, 12).map((landmark, index) => (
              <tr key={landmark.id}>
                <td>{index + 1}</td>
                <td>{landmark.position[0].toFixed(3)}</td>
                <td>{landmark.position[1].toFixed(3)}</td>
                <td>{(-landmark.position[2]).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {layer.landmarks.length > 12 && <p className="table-footnote">{layer.landmarks.length - 12} more landmarks</p>}
      </div>

      {!layer.locked && (
        <button type="button" className="danger-button" onClick={() => onRemove(layer.id)}>
          <Trash2 size={16} /> Delete Individual
        </button>
      )}
    </aside>
  );
}

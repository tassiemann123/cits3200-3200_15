import { useMemo, useState } from "react";
import { ChevronRight, Eye, EyeOff, LockKeyhole, Search } from "lucide-react";
import type { ModelType, SkeletonLayer } from "../types";

interface LayerPanelProps {
  layers: SkeletonLayer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<SkeletonLayer>) => void;
  onShowAll: (visible: boolean) => void;
}

const MODEL_LABELS: Record<ModelType, string> = {
  landmarks: "Landmark skeleton",
  male: "Male reference",
  female: "Female reference",
};

export function LayerPanel({ layers, selectedId, onSelect, onPatch, onShowAll }: LayerPanelProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => layers.filter((layer) => layer.name.toLowerCase().includes(query.trim().toLowerCase())), [layers, query]);
  const visibleCount = layers.filter((layer) => layer.visible).length;

  return (
    <aside className="panel layer-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SCENE LAYERS</p>
          <h2>Individuals & Layers</h2>
        </div>
        <span className="count-pill">{visibleCount}/{layers.length}</span>
      </div>

      <label className="search-field">
        <Search size={16} aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search BP number" />
      </label>

      <div className="layer-actions">
        <button type="button" onClick={() => onShowAll(true)}>Show all</button>
        <button type="button" onClick={() => onShowAll(false)}>Hide all</button>
      </div>

      <div className="layer-list" role="list">
        {filtered.map((layer) => {
          const active = layer.id === selectedId;
          return (
            <div key={layer.id} className={`layer-row ${active ? "active" : ""}`} role="listitem">
              <button
                type="button"
                className="visibility-button"
                aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                onClick={() => onPatch(layer.id, { visible: !layer.visible })}
              >
                {layer.visible ? <Eye size={17} /> : <EyeOff size={17} />}
              </button>
              <button type="button" className="layer-select" onClick={() => onSelect(layer.id)}>
                <span className="color-dot" style={{ background: layer.color }} />
                <span className="layer-copy">
                  <strong>{layer.name}</strong>
                  <small>{MODEL_LABELS[layer.modelType]} · {layer.segments.length} segments</small>
                </span>
                {layer.locked ? <LockKeyhole size={14} className="muted-icon" /> : <ChevronRight size={16} className="muted-icon" />}
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="empty-copy">No matching layers</p>}
      </div>
    </aside>
  );
}

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

export interface ManualEntry {
  skeletonId: string;
  pointName: string;
  x: number;
  y: number;
  z: number;
}

interface ManualEntryDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (entry: ManualEntry) => void;
}

export function ManualEntryDialog({ open, onClose, onAdd }: ManualEntryDialogProps) {
  const [skeletonId, setSkeletonId] = useState("BP");
  const [pointName, setPointName] = useState("1");
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const [z, setZ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { if (!open) setError(""); }, [open]);
  if (!open) return null;

  const submit = () => {
    const values = [Number(x), Number(y), Number(z)];
    if (!skeletonId.trim() || !pointName.trim() || values.some((value) => !Number.isFinite(value))) {
      setError("Enter an individual ID, a landmark name, and valid X, Y, and Z values.");
      return;
    }
    onAdd({ skeletonId: skeletonId.trim(), pointName: pointName.trim(), x: values[0], y: values[1], z: values[2] });
    setPointName(String(Number(pointName) + 1 || pointName));
    setX(""); setY(""); setZ(""); setError("");
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="manual-entry-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">MANUAL COORDINATE</p><h2 id="manual-entry-title">Add Landmark</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="dialog-grid">
          <label className="field-label">Individual ID<input value={skeletonId} onChange={(event) => setSkeletonId(event.target.value)} placeholder="e.g. BP151" /></label>
          <label className="field-label">Landmark name<input value={pointName} onChange={(event) => setPointName(event.target.value)} placeholder="1–25 or a name" /></label>
          <label className="field-label">X<input inputMode="decimal" value={x} onChange={(event) => setX(event.target.value)} placeholder="0.000" /></label>
          <label className="field-label">Y<input inputMode="decimal" value={y} onChange={(event) => setY(event.target.value)} placeholder="0.000" /></label>
          <label className="field-label">Z<input inputMode="decimal" value={z} onChange={(event) => setZ(event.target.value)} placeholder="0.000" /></label>
        </div>
        <p className="dialog-hint">Manual entries use standard X / Y / Z values and are automatically converted to the survey orientation for display.</p>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Done</button>
          <button type="button" className="primary-button" onClick={submit}><Plus size={17} /> Add & Continue</button>
        </div>
      </section>
    </div>
  );
}

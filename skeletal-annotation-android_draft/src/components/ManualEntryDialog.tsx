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
      setError("请输入个体编号、测点名称和有效的 X、Y、Z 数值。");
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
          <div><p className="eyebrow">MANUAL COORDINATE</p><h2 id="manual-entry-title">添加测点</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={20} /></button>
        </div>
        <div className="dialog-grid">
          <label className="field-label">个体编号<input value={skeletonId} onChange={(event) => setSkeletonId(event.target.value)} placeholder="例如 BP151" /></label>
          <label className="field-label">测点名称<input value={pointName} onChange={(event) => setPointName(event.target.value)} placeholder="1–25 或名称" /></label>
          <label className="field-label">X<input inputMode="decimal" value={x} onChange={(event) => setX(event.target.value)} placeholder="0.000" /></label>
          <label className="field-label">Y<input inputMode="decimal" value={y} onChange={(event) => setY(event.target.value)} placeholder="0.000" /></label>
          <label className="field-label">Z<input inputMode="decimal" value={z} onChange={(event) => setZ(event.target.value)} placeholder="0.000" /></label>
        </div>
        <p className="dialog-hint">手动输入使用标准 X / Y / Z；显示时自动转换为现场坐标方向。</p>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>完成</button>
          <button type="button" className="primary-button" onClick={submit}><Plus size={17} /> 添加并继续</button>
        </div>
      </section>
    </div>
  );
}

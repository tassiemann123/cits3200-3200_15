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
        <h2>选择一个个体</h2>
        <p>点击左侧图层或视口中的骨架，查看测点和模型设置。</p>
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
        个体名称
        <input value={layer.name} onChange={(event) => onPatch(layer.id, { name: event.target.value })} disabled={layer.locked} />
      </label>

      <div className="field-label">
        显示模型
        <div className="segmented-control">
          {([
            ["landmarks", "测点"],
            ["male", "男性"],
            ["female", "女性"],
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
        图层颜色
        <span>
          <input type="color" value={layer.color} onChange={(event) => onPatch(layer.id, { color: event.target.value.toUpperCase() })} />
          <code>{layer.color.toUpperCase()}</code>
        </span>
      </label>

      <div className="metric-grid">
        <div><CircleDot size={17} /><span><strong>{layer.landmarks.length}</strong>测点</span></div>
        <div><Minus size={17} /><span><strong>{layer.segments.length}</strong>线段</span></div>
        <div><Bone size={17} /><span><strong>{modelType === "female" ? "118" : modelType === "male" ? "18" : "—"}</strong>{modelType === "female" ? "关节" : modelType === "male" ? "骨段" : "模型"}</span></div>
        <div><Info size={17} /><span><strong>{layer.visible ? "显示" : "隐藏"}</strong>状态</span></div>
      </div>

      {modelType !== "landmarks" && (
        <>
          <div className="research-note">
            <Info size={16} />
            <p>参考模型会按测点范围、方向和比例叠加；当前不代表已完成科研级关节姿态配准。</p>
          </div>
          <p className="model-attribution">
            {modelType === "female"
              ? "Female Skeleton · projectkaizen · CC BY 4.0"
              : "Skeleton Pre-cut · Maxime66410 · Sketchfab Standard"}
          </p>
        </>
      )}

      <label className="field-label notes-field">
        研究备注
        <textarea value={layer.notes} onChange={(event) => onPatch(layer.id, { notes: event.target.value })} placeholder="保存观察、上下文或异常说明…" />
      </label>

      <div className="coordinate-table-wrap">
        <div className="section-title"><span>测点预览</span><small>X / Z / Y</small></div>
        <table className="coordinate-table">
          <thead><tr><th>点</th><th>X</th><th>Z</th><th>Y</th></tr></thead>
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
        {layer.landmarks.length > 12 && <p className="table-footnote">另有 {layer.landmarks.length - 12} 个测点</p>}
      </div>

      {!layer.locked && (
        <button type="button" className="danger-button" onClick={() => onRemove(layer.id)}>
          <Trash2 size={16} /> 删除此个体
        </button>
      )}
    </aside>
  );
}

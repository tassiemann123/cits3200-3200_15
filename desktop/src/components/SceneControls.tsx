import type { Individual } from '../model';

interface SceneControlsProps {
  view: 'perspective' | 'front' | 'top';
  showGrid: boolean;
  showMarkers: boolean;
  onViewChange: (view: 'perspective' | 'front' | 'top') => void;
  onToggleGrid: () => void;
  onToggleMarkers: () => void;
  onFit: () => void;
}

export default function SceneControls({
  view,
  showGrid,
  showMarkers,
  onViewChange,
  onToggleGrid,
  onToggleMarkers,
  onFit,
}: SceneControlsProps) {
  return (
    <div className="scene-toolbar">
      <div className="view-toggle">
        {(['perspective', 'front', 'top'] as const).map(option => (
          <button
            key={option}
            className={view === option ? 'active' : ''}
            onClick={() => onViewChange(option)}
          >
            {option === 'perspective' ? '3D view' : option[0].toUpperCase() + option.slice(1)}
          </button>
        ))}
      </div>

      <div className="scene-options">
        <button
          className={showGrid ? 'active' : ''}
          aria-label="Toggle grid"
          aria-pressed={showGrid}
          title="Grid"
          onClick={onToggleGrid}
        >
          Grid
        </button>

        <button
          className={showMarkers ? 'active' : ''}
          aria-label="Toggle recorded joint markers"
          aria-pressed={showMarkers}
          title="Recorded joint markers"
          onClick={onToggleMarkers}
        >
          Markers
        </button>

        <button aria-label="Fit all skeletons" title="Fit all" onClick={onFit}>
          Fit
        </button>
      </div>
    </div>
  );
}
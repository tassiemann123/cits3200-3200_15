/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG,
 * RUAN VAN ZYL
 *
 * File Function:
 * Toolbar for the 3D view: view buttons (perspective, front, top, bottom),
 * rotate 90 degrees, grid and recorded marker toggles, and fit all skeletons.
 */

import type { Individual } from '../model';

/** Props for SceneControls. */
interface SceneControlsProps {
  view: 'perspective' | 'front' | 'top' | 'bottom';
  showGrid: boolean;
  showMarkers: boolean;
  onViewChange: (view: 'perspective' | 'front' | 'top' | 'bottom') => void;
  onRotate: () => void;
  onToggleGrid: () => void;
  onToggleMarkers: () => void;
  onFit: () => void;
}

/** Renders the view toolbar. */
export default function SceneControls({
  view,
  showGrid,
  showMarkers,
  onViewChange,
  onRotate,
  onToggleGrid,
  onToggleMarkers,
  onFit,
}: SceneControlsProps) {
  return (
    <div className="scene-toolbar">
      <div className="view-toggle">
          {(['perspective', 'front', 'top', 'bottom'] as const).map(option => (
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
          <button aria-label="Rotate view 90 degrees" title="Rotate view 90°" onClick={onRotate}>
            Rotate 90°
          </button>
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

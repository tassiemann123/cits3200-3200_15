import { CFA_GROUPS, pointLabel, type PointName } from '../data/cfaSchema';
import type { SkeletonCoordinates, Coord } from '../types';

interface CoordinatePanelProps {
  open: boolean;
  onToggle: () => void;
  coordinates: SkeletonCoordinates;
  onChangePoint: (point: PointName, coord: Coord) => void;
  onReset: () => void;
  excludedGroups: string[];
  onToggleGroup: (groupLabel: string) => void;
}

// Bottom sliding panel with the CFA-style coordinate entry form.
// Each section (group) has a toggle switch to mark it as "not present"
// on this skeleton (e.g. a missing limb) - inputs in an excluded section
// are disabled and visually dimmed, but any previously entered values
// are kept in state in case the section gets re-enabled later.
export default function CoordinatePanel({
  open,
  onToggle,
  coordinates,
  onChangePoint,
  onReset,
  excludedGroups,
  onToggleGroup,
}: CoordinatePanelProps) {
  function handleFieldChange(point: PointName, axis: 0 | 1 | 2, value: string) {
    const current = coordinates[point] ?? [NaN, NaN, NaN];
    const next: [number, number, number] = [...current] as [number, number, number];
    next[axis] = value === '' ? NaN : Number(value);

    const allEntered = next.every((v) => !Number.isNaN(v));
    onChangePoint(point, allEntered ? next : (next.some((v) => !Number.isNaN(v)) ? next : null));
  }

  function handleReset() {
    const confirmed = window.confirm(
      'Reset all entered coordinates for this skeleton? This cannot be undone.'
    );
    if (confirmed) onReset();
  }

  return (
    <>
      <button
        onClick={onToggle}
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: open ? '55vh' : 16,
          zIndex: 21,
          background: '#2a6b2a',
          color: '#fff',
          border: 'none',
          borderRadius: 20,
          padding: '10px 20px',
          fontFamily: 'sans-serif',
          fontSize: 14,
          cursor: 'pointer',
          transition: 'bottom 0.25s ease',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        {open ? 'Hide coordinates ▼' : 'Enter coordinates ▲'}
      </button>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '55vh',
          background: 'rgba(10,10,10,0.95)',
          borderTop: '1px solid #444',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.25s ease',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px 8px',
            borderBottom: '1px solid #333',
          }}
        >
          <span
            style={{
              color: '#fff',
              fontFamily: 'sans-serif',
              fontWeight: 'bold',
              fontSize: 15,
            }}
          >
            Joint coordinates
          </span>

          <button
            onClick={handleReset}
            style={{
              background: 'transparent',
              color: '#ff6666',
              border: '1px solid #663333',
              borderRadius: 6,
              padding: '5px 10px',
              fontFamily: 'sans-serif',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Reset all
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
          {CFA_GROUPS.map((group) => {
            const isExcluded = excludedGroups.includes(group.label);

            return (
              <div key={group.label} style={{ marginBottom: 14, opacity: isExcluded ? 0.4 : 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      color: '#7fd',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      fontFamily: 'sans-serif',
                    }}
                  >
                    {group.label}
                  </span>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontFamily: 'sans-serif',
                      fontSize: 11,
                      color: '#aaa',
                      cursor: 'pointer',
                    }}
                  >
                    {isExcluded ? 'Not present' : 'Present'}
                    <input
                      type="checkbox"
                      checked={!isExcluded}
                      onChange={() => onToggleGroup(group.label)}
                      style={{ cursor: 'pointer' }}
                    />
                  </label>
                </div>

                {group.points.map((point) => {
                  const coord = coordinates[point];
                  return (
                    <div key={point} style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          color: '#ccc',
                          fontSize: 13,
                          fontFamily: 'sans-serif',
                          marginBottom: 3,
                          textTransform: 'capitalize',
                        }}
                      >
                        {pointLabel(point)}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(['x', 'y', 'z'] as const).map((axisLabel, axisIndex) => (
                          <input
                            key={axisLabel}
                            type="text"
                            inputMode="decimal"
                            placeholder={axisLabel}
                            disabled={isExcluded}
                            value={coord && !Number.isNaN(coord[axisIndex]) ? coord[axisIndex] : ''}
                            onChange={(e) =>
                              handleFieldChange(point, axisIndex as 0 | 1 | 2, e.target.value)
                            }
                            style={{
                              width: '33%',
                              background: isExcluded ? '#161616' : '#1e1e1e',
                              border: '1px solid #555',
                              color: '#fff',
                              padding: '6px 6px',
                              fontFamily: 'monospace',
                              fontSize: 13,
                              borderRadius: 4,
                              cursor: isExcluded ? 'not-allowed' : 'text',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
import { CFA_GROUPS, pointLabel, type PointName } from '../data/cfaSchema';
import type { SkeletonCoordinates, Coord } from '../types';

interface CoordinatePanelProps {
  open: boolean;
  onToggle: () => void;
  coordinates: SkeletonCoordinates;
  onChangePoint: (point: PointName, coord: Coord) => void;
}

// Bottom sliding panel with the CFA-style coordinate entry form.
// Toggled by a button that stays visible whether the panel is open or
// closed, so the skeleton can always be fully viewed by sliding it away.
export default function CoordinatePanel({ open, onToggle, coordinates, onChangePoint }: CoordinatePanelProps) {
  function handleFieldChange(point: PointName, axis: 0 | 1 | 2, value: string) {
    const current = coordinates[point] ?? [NaN, NaN, NaN];
    const next: [number, number, number] = [...current] as [number, number, number];
    next[axis] = value === '' ? NaN : Number(value);

    const allEntered = next.every((v) => !Number.isNaN(v));
    onChangePoint(point, allEntered ? next : (next.some((v) => !Number.isNaN(v)) ? next : null));
  }

  return (
    <>
      {/* Toggle button - always visible, sits just above the panel */}
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

      {/* Sliding panel */}
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
            padding: '14px 16px 8px',
            color: '#fff',
            fontFamily: 'sans-serif',
            fontWeight: 'bold',
            fontSize: 15,
            borderBottom: '1px solid #333',
          }}
        >
          Joint coordinates
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
          {CFA_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 14 }}>
              <div
                style={{
                  color: '#7fd',
                  fontSize: 12,
                  textTransform: 'uppercase',
                  fontFamily: 'sans-serif',
                  marginBottom: 6,
                }}
              >
                {group.label}
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
                          value={coord && !Number.isNaN(coord[axisIndex]) ? coord[axisIndex] : ''}
                          onChange={(e) =>
                            handleFieldChange(point, axisIndex as 0 | 1 | 2, e.target.value)
                          }
                          style={{
                            width: '33%',
                            background: '#1e1e1e',
                            border: '1px solid #555',
                            color: '#fff',
                            padding: '6px 6px',
                            fontFamily: 'monospace',
                            fontSize: 13,
                            borderRadius: 4,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
import { Eye, EyeOff, Plus, Search, Trash2 } from 'lucide-react';
import type { Individual } from '../model';

interface SkeletonSidebarProps {
  individuals: Individual[];
  selectedId: string;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onImport: () => void;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onCoordinateChange: (
    jointId: string,
    endpointIndex: number,
    axis: 0 | 1 | 2,
    value: number | null,
  ) => void;
}

export default function SkeletonSidebar({
  individuals,
  selectedId,
  query,
  onQueryChange,
  onSelect,
  onToggleVisibility,
  onDelete,
  onAdd,
  onImport,
  onNameChange,
  onColorChange,
  onCoordinateChange,
}: SkeletonSidebarProps) {
  const selected =
    individuals.find(individual => individual.id === selectedId) ??
    individuals[0];

  const filteredIndividuals = individuals.filter(individual =>
    `${individual.name} ${individual.accession}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <aside className="skeleton-sidebar">
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <h2>Skeletons</h2>

          <button
            className="icon-button"
            type="button"
            aria-label="Add skeleton"
            title="Add skeleton"
            onClick={onAdd}
          >
            <Plus size={17} />
          </button>
        </div>

        <label className="search-field">
          <Search size={15} />

          <input
            type="text"
            placeholder="Find a skeleton..."
            value={query}
            onChange={event =>
              onQueryChange(event.target.value)
            }
          />
        </label>

        <div className="skeleton-list">
          {filteredIndividuals.map(individual => (
            <div
              key={individual.id}
              className={`skeleton-row ${
                individual.id === selected?.id ? 'selected' : ''
              }`}
            >
              <button
                className="skeleton-select"
                type="button"
                onClick={() => onSelect(individual.id)}
              >
                <span
                  className="skeleton-color-dot"
                  style={{
                    backgroundColor: individual.color,
                  }}
                />

                <span className="skeleton-row-info">
                  <strong>{individual.name}</strong>
                  <small>{individual.accession}</small>
                </span>
              </button>

              <button
                className="visibility-button"
                type="button"
                aria-label={
                  individual.visible
                    ? `Hide ${individual.name}`
                    : `Show ${individual.name}`
                }
                title={
                  individual.visible
                    ? 'Hide skeleton'
                    : 'Show skeleton'
                }
                onClick={() =>
                  onToggleVisibility(individual.id)
                }
              >
                {individual.visible ? (
                  <Eye size={15} />
                ) : (
                  <EyeOff size={15} />
                )}
              </button>
            </div>
          ))}

          {filteredIndividuals.length === 0 && (
            <div className="empty-search">
              No skeletons found.
            </div>
          )}
        </div>

        <button
          className="sidebar-import-button"
          type="button"
          onClick={onImport}
        >
          Import
        </button>
      </div>

      {selected && (
        <div className="selected-skeleton">
          <div className="sidebar-divider" />

          <div className="selected-skeleton-header">
            <h3>Selected Skeleton</h3>

            <button
              className="icon-button delete-skeleton-button"
              type="button"
              aria-label="Delete skeleton"
              title="Delete skeleton"
              onClick={() => onDelete(selected.id)}
            >
              <Trash2 size={15} />
            </button>
          </div>

          <label className="field-label">
            Name

            <input
              className="text-input"
              type="text"
              value={selected.name}
              onChange={event =>
                onNameChange(event.target.value)
              }
            />
          </label>

          <label className="field-label">
            Colour

            <span className="colour-input-wrapper">
              <input
                className="colour-input"
                type="color"
                value={selected.color}
                onChange={event =>
                  onColorChange(event.target.value)
                }
              />

              <span>{selected.color}</span>
            </span>
          </label>

          <div className="coordinates-section">
            <h3>CFA Coordinates</h3>

            <div className="coordinate-table">
              <div className="coordinate-header">
                <span>Point</span>
                <span>X</span>
                <span>Y</span>
                <span>Z</span>
              </div>

              <div className="coordinate-rows">
                {selected.joints.map(joint =>
                  joint.endpoints.map(
                    (endpoint, endpointIndex) => (
                      <div
                        className="coordinate-row"
                        key={`${joint.id}-${endpointIndex}`}
                      >
                        <span className="coordinate-point">
                          {endpoint.label}
                        </span>

                        {[0, 1, 2].map(axis => (
                          <input
                            key={axis}
                            className="coordinate-input"
                            type="number"
                            step="0.001"
                            value={
                              endpoint.coordinate[axis] ?? ''
                            }
                            placeholder="—"
                            onChange={event => {
                              const value =
                                event.target.value.trim();

                              onCoordinateChange(
                                joint.id,
                                endpointIndex,
                                axis as 0 | 1 | 2,
                                value === ''
                                  ? null
                                  : Number(value),
                              );
                            }}
                          />
                        ))}
                      </div>
                    ),
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
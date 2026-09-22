import { useState } from 'react';
import { Eye, EyeOff, Plus, Search, Trash2, Check, X , Download, Upload} from 'lucide-react';
import type { Individual, BoneStatus } from '../model';
import { CFA_GROUPS } from '../data/cfaSchema';

interface SkeletonSidebarProps {
  individuals: Individual[];
  selectedId: string;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onExport: (id: string) => void;
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
  onBoneStatusChange: (boneId: string, status: BoneStatus) => void;
}

// Works out whether an entire group counts as "present": true only if
// every bone belonging to that group's joints is marked present.
function getGroupStatus(
  individual: Individual,
  groupPoints: readonly string[],
): BoneStatus {
  const relevantBoneIds = new Set(
    individual.joints
      .filter(joint => groupPoints.includes(joint.id))
      .flatMap(joint => joint.endpoints.map(e => e.boneId)),
  );

  const statuses = individual.bones
    .filter(bone => relevantBoneIds.has(bone.id))
    .map(bone => bone.status);

  if (statuses.length === 0) return 'unrecorded';
  if (statuses.every(s => s === 'present')) return 'present';
  if (statuses.some(s => s === 'absent')) return 'absent';
  return 'unrecorded';
}

export default function SkeletonSidebar({
  individuals,
  selectedId,
  query,
  onQueryChange,
  onSelect,
  onToggleVisibility,
  onExport,
  onDelete,
  onAdd,
  onImport,
  onNameChange,
  onColorChange,
  onCoordinateChange,
  onBoneStatusChange,
}: SkeletonSidebarProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

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
            onChange={event => onQueryChange(event.target.value)}
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
                  style={{ backgroundColor: individual.color }}
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
                  individual.visible ? 'Hide skeleton' : 'Show skeleton'
                }
                onClick={() => onToggleVisibility(individual.id)}
              >
                {individual.visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            </div>
          ))}

          {filteredIndividuals.length === 0 && (
            <div className="empty-search">No skeletons found.</div>
          )}
        </div>

        <button
          className="button primary sidebar-import-button"
          type="button"
          onClick={onImport}
        >
          <Download size={14} />
          Import
        </button>
      </div>

      {selected && (
        <div className="selected-skeleton">
          <div className="sidebar-divider" />

          <div className="sidebar-section-header">
            <h2>{selected.name}</h2>

            <div className="header-icon-group">
              <button
                className="icon-button"
                type="button"
                aria-label="Export skeleton"
                title="Export skeleton"
                onClick={() => onExport(selected.id)}
              >
                <Upload size={15} />
              </button>

              <button
                className="icon-button"
                type="button"
                aria-label="Delete skeleton"
                title="Delete skeleton"
                onClick={() => onDelete(selected.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          <label className="field-label">
            Name
            <input
              className="text-input"
              type="text"
              value={selected.name}
              onChange={event => onNameChange(event.target.value)}
            />
          </label>

          <label className="field-label">
            Colour
            <span className="colour-input-wrapper">
              <input
                className="colour-input"
                type="color"
                value={selected.color}
                onChange={event => onColorChange(event.target.value)}
              />
              <span>{selected.color}</span>
            </span>
          </label>

          <div className="coordinates-section">
            <h3>CFA Coordinates</h3>

            {CFA_GROUPS.map(group => {
              const groupJoints = group.points
                .map(point => selected.joints.find(joint => joint.id === point))
                .filter((joint): joint is Individual['joints'][number] => !!joint);

              const status = getGroupStatus(selected, group.points);

              const relevantBoneIds = new Set(
                groupJoints.flatMap(joint =>
                  joint.endpoints.map(e => e.boneId),
                ),
              );

              const handleTogglePresence = () => {
                const nextStatus: BoneStatus =
                  status === 'present' ? 'absent' : 'present';

                const boneIds =
                  group.id === 'head_torso'
                    ? ['spine']
                    : [...relevantBoneIds];

                boneIds.forEach(boneId =>
                  onBoneStatusChange(boneId, nextStatus),
                );
              };

              const collapsed = collapsedGroups.includes(group.id);

              return (
                <div className="coordinate-group" key={group.id}>
                  <div className="coordinate-group-header">
                    <button
                      type="button"
                      className="coordinate-group-toggle"
                      onClick={() =>
                        setCollapsedGroups(groups =>
                          collapsed
                            ? groups.filter(id => id !== group.id)
                            : [...groups, group.id],
                        )
                      }
                    >
                      <span>{collapsed ? '▸' : '▾'}</span>
                      <h4 className="coordinate-group-label">
                        {group.label}
                      </h4>
                    </button>

                    <button
                      type="button"
                      className={`presence-pill ${status}`}
                      onClick={handleTogglePresence}
                    >
                      {status === 'present' ? (
                        <Check size={14} />
                      ) : (
                        <X size={14} />
                      )}
                      {status === 'present' ? 'Present' : 'Not present'}
                    </button>
                  </div>

                  {!collapsed && (
                    <div className="coordinate-rows">
                      {groupJoints.map(joint => {
                        const endpoint = joint.endpoints[0];

                        const pointName = joint.label
                          .replace(/^Left /, '')
                          .replace(/^Right /, '');

                        return (
                          <div className="coordinate-row" key={joint.id}>
                            <span className="coordinate-point">
                              {pointName}
                            </span>

                            {[0, 1, 2].map(axis => (
                              <label
                                className="coordinate-field"
                                key={axis}
                              >
                                <span>{['X:', 'Y:', 'Z:'][axis]}</span>

                                <input
                                  className="coordinate-input"
                                  type="number"
                                  step="1"
                                  value={endpoint.coordinate[axis] ?? ''}
                                  placeholder="—"
                                  onChange={event => {
                                    const value = event.target.value.trim();

                                    onCoordinateChange(
                                      joint.id,
                                      0,
                                      axis as 0 | 1 | 2,
                                      value === ''
                                        ? null
                                        : Number(value),
                                    );
                                  }}
                                />
                              </label>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
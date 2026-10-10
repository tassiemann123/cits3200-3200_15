import { useState } from 'react';
import { Eye, EyeOff, Plus, Search, Trash2, Check, X, Download, Upload } from 'lucide-react';
import type { Individual, BoneStatus, Endpoint } from '../model';
import { CFA_GROUPS } from '../data/cfaSchema';

interface SkeletonSidebarProps {
  individuals: Individual[];
  selectedId: string;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onSetAllVisibility: (visible: boolean) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onImport: () => void;
  onImportFiles: (files: File[]) => void;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onGroupPresenceChange: (groupId: string, present: boolean) => void;
  onCoordinateChange: (
    jointId: string,
    endpointIndex: number,
    axis: 0 | 1 | 2,
    value: number | null,
  ) => void;
  onBoneStatusChange: (boneId: string, status: BoneStatus) => void;
}

// Bones each group controls. Joints are shared between bones (e.g. the acetabulum
// belongs to both the pelvis and the femur), so the ownership is listed explicitly.
const GROUP_BONES: Record<string, string[]> = {
  left_arm: ['left_clavicle', 'left_humerus', 'left_forearm', 'left_hand'],
  right_arm: ['right_clavicle', 'right_humerus', 'right_forearm', 'right_hand'],
  left_leg: ['left_femur', 'left_lower_leg', 'left_foot'],
  right_leg: ['right_femur', 'right_lower_leg', 'right_foot'],
};

// A group is "present" only if every bone it controls is present.
function getGroupStatus(individual: Individual, boneIds: string[]): BoneStatus {
  const statuses = individual.bones
    .filter(bone => boneIds.includes(bone.id))
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
  onSetAllVisibility,
  onExport,
  onDelete,
  onAdd,
  onImport,
  onImportFiles,
  onNameChange,
  onColorChange,
  onGroupPresenceChange,
  onCoordinateChange,
  onBoneStatusChange,
}: SkeletonSidebarProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [draggingFiles, setDraggingFiles] = useState(false);

  const selected =
    individuals.find(individual => individual.id === selectedId) ??
    individuals[0];
  const allVisible = individuals.length > 0 && individuals.every(individual => individual.visible);

  const searchTerms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filteredIndividuals = individuals.filter(individual => {
    const searchableText = `${individual.name} ${individual.accession}`.toLowerCase();
    return searchTerms.every(term => searchableText.includes(term));
  });

  // X / Y / Z inputs for one endpoint of one joint.
  const renderInputs = (
    jointId: string,
    endpoint: Endpoint,
    endpointIndex: number,
  ) =>
    [0, 1, 2].map(axis => (
      <label className="coordinate-field" key={axis}>
        <span>{['X:', 'Y:', 'Z:'][axis]}</span>

        <input
          className="coordinate-input"
          type="number"
          step="any"
          value={endpoint.coordinate[axis] ?? ''}
          placeholder="—"
          onChange={event => {
            const value = event.target.value.trim();

            onCoordinateChange(
              jointId,
              endpointIndex,
              axis as 0 | 1 | 2,
              value === '' ? null : Number(value),
            );
          }}
        />
      </label>
    ));

  return (
    <aside
      className={`skeleton-sidebar${draggingFiles ? ' drag-over' : ''}`}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setDraggingFiles(true);
      }}
      onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingFiles(false);
      }}
      onDrop={event => {
        event.preventDefault();
        setDraggingFiles(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length) onImportFiles(files);
      }}
    >
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <h2>Skeletons</h2>

          <div className="header-icon-group">
            <button
              className="icon-button"
              type="button"
              aria-label={allVisible ? 'Hide all skeletons' : 'Show all skeletons'}
              title={allVisible ? 'Hide all skeletons' : 'Show all skeletons'}
              disabled={individuals.length === 0}
              onClick={() => onSetAllVisibility(!allVisible)}
            >
              {allVisible ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
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
        <small className="sidebar-drop-hint">or drop CSV files here</small>
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

              const boneIds = GROUP_BONES[group.id] ?? [];
              const separatePresence = ['head', 'spine_ribcage', 'sacrum', 'left_pelvis', 'right_pelvis'].includes(group.id);
              const status = separatePresence
                ? selected.absentGroups?.includes(group.id) ? 'absent' : 'present'
                : getGroupStatus(selected, boneIds);

              const handleTogglePresence = () => {
                const nextStatus: BoneStatus =
                  status === 'present' ? 'absent' : 'present';

                if (separatePresence) onGroupPresenceChange(group.id, nextStatus === 'present');
                else boneIds.forEach(boneId => onBoneStatusChange(boneId, nextStatus));

                setCollapsedGroups(groups =>
                  nextStatus === 'absent'
                    ? groups.includes(group.id) ? groups : [...groups, group.id]
                    : groups.filter(id => id !== group.id),
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
                        const pointName = joint.label
                          .replace(/^Left /, '')
                          .replace(/^Right /, '');

                        // Landmarks and single-bone joints: one bold row.
                        if (joint.endpoints.length === 1) {
                          return (
                            <div className="coordinate-row" key={joint.id}>
                              <span className="coordinate-point strong">
                                {pointName}
                              </span>

                              {renderInputs(joint.id, joint.endpoints[0], 0)}
                            </div>
                          );
                        }

                        // Joints shared by several bones: a bold joint title, then
                        // one row per bone with a checkbox in front of its name.
                        return (
                          <div key={joint.id}>
                            <div className="coordinate-row joint-title">
                              <span className="coordinate-point strong">
                                {pointName}
                              </span>
                            </div>

                            {joint.endpoints.map((endpoint, endpointIndex) => {
                              const bone = selected.bones.find(
                                item => item.id === endpoint.boneId,
                              );

                              return (
                                <div
                                  className="coordinate-row"
                                  key={`${joint.id}-${endpointIndex}`}
                                >
                                  <label className="coordinate-point bone-check">
                                    {bone && (
                                      <input
                                        type="checkbox"
                                        checked={bone.status === 'present'}
                                        title="Present"
                                        onChange={event =>
                                          onBoneStatusChange(
                                            bone.id,
                                            event.target.checked
                                              ? 'present'
                                              : 'absent',
                                          )
                                        }
                                      />
                                    )}
                                    <span>{endpoint.label}</span>
                                  </label>

                                  {renderInputs(
                                    joint.id,
                                    endpoint,
                                    endpointIndex,
                                  )}
                                </div>
                              );
                            })}
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

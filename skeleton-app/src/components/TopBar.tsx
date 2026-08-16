import { useState } from 'react';
import type { Project } from '../types';

interface TopBarProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onRenameProject: (id: string, newName: string) => void;
}

// Top button opens a dropdown listing every project (skeleton). Selecting
// one switches the active skeleton; "+ New skeleton" creates another.
// Each row has a small rename (pencil) control that swaps to an inline
// text input, so renaming doesn't need a separate popup/dialog.
export default function TopBar({
  projects,
  activeProjectId,
  onSelectProject,
  onNewProject,
  onRenameProject,
}: TopBarProps) {
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const activeProject = projects.find((p) => p.id === activeProjectId);

  function startRename(p: Project) {
    setRenamingId(p.id);
    setDraftName(p.name);
  }

  function commitRename() {
    if (renamingId && draftName.trim()) {
      onRenameProject(renamingId, draftName.trim());
    }
    setRenamingId(null);
  }

  return (
    <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 20 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'rgba(0,0,0,0.85)',
          color: '#fff',
          border: '1px solid #444',
          borderRadius: 8,
          padding: '10px 14px',
          fontFamily: 'sans-serif',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
        }}
      >
        <span>📁</span>
        <span>{activeProject ? activeProject.name : 'Select skeleton'}</span>
        <span style={{ opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          style={{
            marginTop: 6,
            background: 'rgba(0,0,0,0.92)',
            border: '1px solid #444',
            borderRadius: 8,
            minWidth: 240,
            overflow: 'hidden',
          }}
        >
          {projects.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 10px 10px 14px',
                background: p.id === activeProjectId ? 'rgba(102,204,255,0.15)' : 'transparent',
                borderBottom: '1px solid #2a2a2a',
              }}
            >
              {renamingId === p.id ? (
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    background: '#1e1e1e',
                    border: '1px solid #66ccff',
                    color: '#fff',
                    borderRadius: 4,
                    padding: '4px 6px',
                    fontFamily: 'sans-serif',
                    fontSize: 14,
                    marginRight: 8,
                  }}
                />
              ) : (
                <span
                  onClick={() => {
                    onSelectProject(p.id);
                    setOpen(false);
                  }}
                  style={{
                    flex: 1,
                    color: '#fff',
                    fontFamily: 'sans-serif',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  {p.name}
                </span>
              )}

              <span
                onClick={(e) => {
                  e.stopPropagation();
                  startRename(p);
                }}
                title="Rename"
                style={{
                  cursor: 'pointer',
                  padding: '2px 6px',
                  opacity: 0.7,
                  fontSize: 14,
                }}
              >
                ✏️
              </span>
            </div>
          ))}

          <div
            onClick={() => {
              onNewProject();
              setOpen(false);
            }}
            style={{
              padding: '10px 14px',
              color: '#66ccff',
              fontFamily: 'sans-serif',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            + New skeleton
          </div>
        </div>
      )}
    </div>
  );
}
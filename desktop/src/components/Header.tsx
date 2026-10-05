import { Upload, Pencil, Plus, Save, FolderOpen } from 'lucide-react';

interface HeaderProps {
  graveyards: { id: string; name: string }[];
  currentGraveyardId: string;
  onGraveyardChange: (id: string) => void;
  onManageGraveyard: () => void;
  onNewGraveyard: () => void;
  onSave: () => void;
  onOpenBackend: () => void;
  backendState: 'local' | 'saving' | 'saved' | 'offline' | 'conflict';
  onExport: () => void;
}

export default function Header({
  graveyards,
  currentGraveyardId,
  onGraveyardChange,
  onManageGraveyard,
  onNewGraveyard,
  onSave,
  onOpenBackend,
  backendState,
  onExport,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-actions">
        <div className="graveyard-selector">
          <span>Graveyard:</span>

          <select
            value={currentGraveyardId}
            onChange={event => onGraveyardChange(event.target.value)}
          >
            {graveyards.map(graveyard => (
              <option key={graveyard.id} value={graveyard.id}>
                {graveyard.name}
              </option>
            ))}
          </select>
        </div>

        <button className="header-button" aria-label="Manage graveyards" onClick={onManageGraveyard}>
          <Pencil size={16} />
        </button>

        <button className="header-button" aria-label="New graveyard" onClick={onNewGraveyard}>
          <Plus size={16} />
        </button>

        <button className="header-button backend-open-button" onClick={onOpenBackend} title="Open a desktop workspace from the backend">
          <FolderOpen size={16} />
          Open from backend
        </button>

        {backendState !== 'local' && (
          <span className="backend-state" role="status">
            {backendState === 'saved' ? 'Backend saved' : backendState === 'saving' ? 'Syncing…' : backendState === 'conflict' ? 'Backend conflict' : 'Local only'}
          </span>
        )}

        <button className="header-button" onClick={onSave} disabled={backendState === 'saving'} title="Save locally and sync this desktop workspace">
          <Save size={16} />
          Save workspace
        </button>

        <button className="button primary" onClick={onExport}>
          <Upload size={16} />
          Export
        </button>
      </div>
    </header>
  );
}

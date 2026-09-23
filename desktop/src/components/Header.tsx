import { Upload, Pencil, Plus, Save } from 'lucide-react';

interface HeaderProps {
  graveyards: { id: string; name: string }[];
  currentGraveyardId: string;
  onGraveyardChange: (id: string) => void;
  onManageGraveyard: () => void;
  onNewGraveyard: () => void;
  onSave: () => void;
  onExport: () => void;
}

export default function Header({
  graveyards,
  currentGraveyardId,
  onGraveyardChange,
  onManageGraveyard,
  onNewGraveyard,
  onSave,
  onExport,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-title">
        <img className="app-title-icon" src="/icon.svg" alt="" />
        <span>OsteoPlot</span>
      </div>

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

        <button className="header-button" onClick={onManageGraveyard}>
          <Pencil size={16} />
        </button>

        <button className="header-button" onClick={onNewGraveyard}>
          <Plus size={16} />
        </button>

        <button className="header-button" onClick={onSave}>
          <Save size={16} />
          Save
        </button>

        <button className="button primary" onClick={onExport}>
          <Upload size={16} />
          Export
        </button>
      </div>
    </header>
  );
}
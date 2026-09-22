import { Upload, Plus } from 'lucide-react';

interface HeaderProps {
  graveyardName: string;
  onNewGraveyard: () => void;
  onExport: () => void;
}

export default function Header({
  graveyardName,
  onNewGraveyard,
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
          <select value={graveyardName} disabled>
            <option>{graveyardName}</option>
          </select>
        </div>

        <button className="header-button" onClick={onNewGraveyard}>
          <Plus size={16} />
          New
        </button>

        <button className="button primary" onClick={onExport}>
          <Upload size={16} />
          Export
        </button>
      </div>
    </header>
  );
}
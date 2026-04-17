import { useState } from 'react';
import { LayoutList, GitBranch } from 'lucide-react';
import { ClueListView } from './clues/ClueListView';
import { ClueEdgeGraph } from './clues/ClueEdgeGraph';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CluesTabProps {
  themeId: string;
}

type SubTab = 'list' | 'relations';

const SUB_TABS: { key: SubTab; label: string; icon: React.ElementType }[] = [
  { key: 'list', label: '목록', icon: LayoutList },
  { key: 'relations', label: '관계', icon: GitBranch },
];

// ---------------------------------------------------------------------------
// CluesTab
// ---------------------------------------------------------------------------

export function CluesTab({ themeId }: CluesTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('list');

  return (
    <div className="flex h-full flex-col">
      {/* SubTab Navigation */}
      <nav className="flex shrink-0 border-b border-slate-800 bg-slate-950 px-2">
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSubTab(key)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeSubTab === key
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </nav>

      {/* SubTab Content */}
      <div className="min-h-0 flex-1">
        {activeSubTab === 'list' && <ClueListView themeId={themeId} />}
        {activeSubTab === 'relations' && <ClueEdgeGraph themeId={themeId} />}
      </div>
    </div>
  );
}

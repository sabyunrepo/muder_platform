import { useState } from 'react';
import { List, UserCheck } from 'lucide-react';
import { CharacterListTab } from './CharacterListTab';
import { CharacterAssignPanel } from './design/CharacterAssignPanel';
import type { EditorThemeResponse } from '@/features/editor/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SubTab = 'list' | 'assignment';

interface CharactersTabProps {
  themeId: string;
  theme: EditorThemeResponse;
}

const SUB_TABS: { key: SubTab; label: string; icon: React.ElementType }[] = [
  { key: 'list', label: '목록', icon: List },
  { key: 'assignment', label: '배정', icon: UserCheck },
];

// ---------------------------------------------------------------------------
// CharactersTab
// ---------------------------------------------------------------------------

export function CharactersTab({ themeId, theme }: CharactersTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('list');

  return (
    <div className="flex h-full flex-col">
      {/* ── SubTab Navigation ── */}
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

      {/* ── SubTab Content ── */}
      <div className="min-h-0 flex-1 overflow-auto">
        {activeSubTab === 'list' && <CharacterListTab themeId={themeId} />}
        {activeSubTab === 'assignment' && (
          <CharacterAssignPanel themeId={themeId} theme={theme} />
        )}
      </div>
    </div>
  );
}

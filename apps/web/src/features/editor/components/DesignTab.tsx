import { useState } from 'react';
import { Puzzle, GitBranch, MapPin } from 'lucide-react';
import type { EditorThemeResponse } from '@/features/editor/api';
import { ModulesSubTab } from './design/ModulesSubTab';
import { FlowSubTab } from './design/FlowSubTab';
import { LocationsSubTab } from './design/LocationsSubTab';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SubTab = 'modules' | 'flow' | 'locations';

interface DesignTabProps {
  themeId: string;
  theme: EditorThemeResponse;
}

const SUB_TABS: { key: SubTab; label: string; icon: React.ElementType }[] = [
  { key: 'modules', label: '모듈', icon: Puzzle },
  { key: 'flow', label: '흐름', icon: GitBranch },
  { key: 'locations', label: '장소', icon: MapPin },
];

// ---------------------------------------------------------------------------
// DesignTab
// ---------------------------------------------------------------------------

export function DesignTab({ themeId, theme }: DesignTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('modules');

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
      <div className="min-h-0 flex-1">
        {activeSubTab === 'modules' && (
          <ModulesSubTab themeId={themeId} theme={theme} />
        )}
        {activeSubTab === 'flow' && (
          <FlowSubTab themeId={themeId} />
        )}
        {activeSubTab === 'locations' && (
          <LocationsSubTab themeId={themeId} theme={theme} />
        )}
      </div>
    </div>
  );
}

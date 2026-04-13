import { useState } from 'react';
import { Layout, Users } from 'lucide-react';
import type { EditorThemeResponse } from '@/features/editor/api';
import { CluePlacementPanel } from './CluePlacementPanel';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AssignmentSubTabProps {
  themeId: string;
  theme: EditorThemeResponse;
}

// ---------------------------------------------------------------------------
// Inner tab definition
// ---------------------------------------------------------------------------

type InnerTab = 'clue-placement' | 'character-assignment';

const INNER_TABS: { key: InnerTab; label: string; icon: React.ElementType }[] = [
  { key: 'clue-placement', label: '단서 배치', icon: Layout },
  { key: 'character-assignment', label: '캐릭터 배정', icon: Users },
];

// ---------------------------------------------------------------------------
// AssignmentSubTab
// ---------------------------------------------------------------------------

export function AssignmentSubTab({ themeId, theme }: AssignmentSubTabProps) {
  const [activeTab, setActiveTab] = useState<InnerTab>('clue-placement');

  return (
    <div className="flex h-full flex-col">
      {/* ── Inner tab nav ── */}
      <nav className="flex shrink-0 border-b border-slate-800 bg-slate-950/60 px-3">
        {INNER_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === key
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </nav>

      {/* ── Inner tab content ── */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'clue-placement' && (
          <CluePlacementPanel themeId={themeId} theme={theme} />
        )}
        {activeTab === 'character-assignment' && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-slate-700" />
              <p className="text-xs font-mono uppercase tracking-widest text-slate-700">
                다음 PR에서 구현
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

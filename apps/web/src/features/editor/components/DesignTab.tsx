import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Puzzle, GitBranch, MapPin, Drama } from 'lucide-react';
import type { EditorThemeResponse } from '@/features/editor/api';
import {
  readDesignSubTabFromRouteSegment,
  type DesignSubTab,
} from '@/features/editor/routeSegments';
import { ModulesSubTab } from './design/ModulesSubTab';
import { FlowSubTab } from './design/FlowSubTab';
import { LocationsSubTab } from './design/LocationsSubTab';
import { EndingEntitySubTab } from './design/EndingEntitySubTab';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DesignTabProps {
  themeId: string;
  theme: EditorThemeResponse;
  routeSegment?: string;
}

const SUB_TABS: { key: DesignSubTab; label: string; icon: React.ElementType }[] = [
  { key: 'modules', label: '모듈', icon: Puzzle },
  { key: 'flow', label: '흐름', icon: GitBranch },
  { key: 'endings', label: '결말', icon: Drama },
  { key: 'locations', label: '장소', icon: MapPin },
];

// ---------------------------------------------------------------------------
export function DesignTab({ themeId, theme, routeSegment }: DesignTabProps) {
  const navigate = useNavigate();
  const [activeSubTab, setActiveSubTab] = useState<DesignSubTab>(() =>
    readDesignSubTabFromRouteSegment(routeSegment),
  );

  useEffect(() => {
    setActiveSubTab(readDesignSubTabFromRouteSegment(routeSegment));
  }, [routeSegment]);

  const handleSubTabClick = (key: DesignSubTab) => {
    setActiveSubTab(key);
    navigate(`/editor/${themeId}/${key}`);
  };

  return (
    <div className="flex h-full flex-col">
      {/* ── SubTab Navigation ── */}
      <nav className="flex shrink-0 border-b border-slate-800 bg-slate-950 px-2">
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleSubTabClick(key)}
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
        {activeSubTab === 'endings' && (
          <EndingEntitySubTab themeId={themeId} theme={theme} />
        )}
        {activeSubTab === 'locations' && (
          <LocationsSubTab themeId={themeId} theme={theme} />
        )}
      </div>
    </div>
  );
}

import type { EditorThemeResponse } from '@/features/editor/api';
import { ModulesSubTab } from './design/ModulesSubTab';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DesignTabProps {
  themeId: string;
  theme: EditorThemeResponse;
  routeSegment?: string;
}

// ---------------------------------------------------------------------------
export function DesignTab({ themeId, theme }: DesignTabProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <ModulesSubTab themeId={themeId} theme={theme} />
      </div>
    </div>
  );
}

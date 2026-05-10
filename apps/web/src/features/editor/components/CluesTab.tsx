import { ClueListView } from './clues/ClueListView';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CluesTabProps {
  themeId: string;
  routeSegment?: string;
}

// ---------------------------------------------------------------------------
// CluesTab
// ---------------------------------------------------------------------------

export function CluesTab({ themeId }: CluesTabProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <ClueListView themeId={themeId} />
      </div>
    </div>
  );
}

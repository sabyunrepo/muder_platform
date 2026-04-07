import {
  selectCurrentLine,
  selectPausedReason,
  selectSectionId,
  selectStatus,
  useReadingStore,
} from "@/stores/readingStore";
import { ReadingControls } from "./ReadingControls";
import { ReadingLine } from "./ReadingLine";
import { ReadingPausedBanner } from "./ReadingPausedBanner";

export interface ReadingOverlayProps {
  /** Role name assigned to the current user, if any. */
  currentUserRole: string | null;
  /** Whether the current user is the room host. */
  isHost: boolean;
  /** Called when the user clicks the advance button. */
  onAdvance: () => void;
}

/**
 * Fixed overlay anchored to the bottom of the game play screen. Renders the
 * currently playing reading line, a paused banner when applicable, and the
 * advance controls based on the line's advanceBy directive.
 *
 * Returns null when no reading section is active. The component is purely
 * presentational — mounting on the game play page is handled by the caller.
 */
export function ReadingOverlay({
  currentUserRole,
  isHost,
  onAdvance,
}: ReadingOverlayProps) {
  const sectionId = useReadingStore(selectSectionId);
  const currentLine = useReadingStore(selectCurrentLine);
  const status = useReadingStore(selectStatus);
  const pausedReason = useReadingStore(selectPausedReason);

  if (!sectionId || !currentLine || status === "idle" || status === "completed") {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      data-testid="reading-overlay"
    >
      {status === "paused" && <ReadingPausedBanner reason={pausedReason} />}
      <div className="pointer-events-auto bg-slate-900/95 backdrop-blur border-t border-slate-700 p-4">
        <ReadingLine line={currentLine} />
        <ReadingControls
          line={currentLine}
          currentUserRole={currentUserRole}
          isHost={isHost}
          status={status}
          onAdvance={onAdvance}
        />
      </div>
    </div>
  );
}

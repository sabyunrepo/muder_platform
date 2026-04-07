import type { ReadingLineWire } from "@/stores/readingStore";
import { TypewriterEffect } from "./TypewriterEffect";

export interface ReadingLineProps {
  line: ReadingLineWire;
}

/**
 * Renders a single reading line: speaker label + typewriter-revealed text.
 */
export function ReadingLine({ line }: ReadingLineProps) {
  return (
    <div className="max-w-3xl mx-auto">
      {line.speaker && (
        <p className="text-xs font-medium text-amber-400 mb-1">{line.speaker}</p>
      )}
      <TypewriterEffect text={line.text} durationMs={null} />
    </div>
  );
}

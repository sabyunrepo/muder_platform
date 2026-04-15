import type { ReactNode } from "react";
import type { GamePhase } from "@mmp/shared";
import { PhaseBar } from "./PhaseBar";
import { PhaseTimer } from "./PhaseTimer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GameLayoutProps {
  /** Current phase — forwarded to PhaseBar. */
  phase: GamePhase | null;
  /** Current round (1-based). */
  round?: number;
  /** Deadline timestamp (Unix ms). Null = no timer. */
  deadlineMs?: number | null;
  /** Main content area. */
  children: ReactNode;
  /** Optional footer slot (e.g. mobile chat toggle). */
  footer?: ReactNode;
}

// ---------------------------------------------------------------------------
// GameLayout
// ---------------------------------------------------------------------------

/**
 * Root layout shell for the in-game screen.
 *
 * Structure:
 *   ┌─ PhaseBar (sticky top) ─────────────────┐
 *   │  [phase chips]              [timer] [Rn] │
 *   │  ──── progress line ─────────────────── │
 *   ├─ content area (flex-1, overflow-y-auto) ─┤
 *   │  {children}                              │
 *   └─ footer slot ────────────────────────────┘
 */
export function GameLayout({
  phase,
  round = 1,
  deadlineMs = null,
  children,
  footer,
}: GameLayoutProps) {
  return (
    <div className="flex h-screen flex-col bg-slate-950">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40">
        <div className="flex items-center border-b border-slate-800 bg-slate-900/95 backdrop-blur">
          {/* Phase chips take all available space */}
          <div className="min-w-0 flex-1">
            <PhaseBar phase={phase} round={round} />
          </div>

          {/* Timer pinned to the right of the header */}
          {deadlineMs !== null && (
            <div className="shrink-0 border-l border-slate-800 px-4 py-2">
              <PhaseTimer deadlineMs={deadlineMs} />
            </div>
          )}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 overflow-y-auto">{children}</main>

      {/* ── Footer (optional) ── */}
      {footer && (
        <footer className="shrink-0 border-t border-slate-800">
          {footer}
        </footer>
      )}
    </div>
  );
}

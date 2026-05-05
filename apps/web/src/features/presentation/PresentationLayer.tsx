import { useState } from "react";
import { WsEventType } from "@mmp/shared";

import { useWsEvent } from "@/hooks/useWsEvent";

interface BackgroundPayload {
  mediaId?: string;
  url?: string;
}

interface ThemeColorPayload {
  themeToken?: string;
}

interface PresentationState {
  backgroundMediaId: string | null;
  backgroundUrl: string | null;
  themeToken: string;
}

const THEME_CLASS: Record<string, string> = {
  noir: "from-slate-950 via-slate-950 to-slate-900",
  tension: "from-slate-950 via-red-950/70 to-slate-950",
  calm: "from-slate-950 via-cyan-950/50 to-slate-950",
  reveal: "from-slate-950 via-amber-950/40 to-slate-950",
};

export function PresentationLayer({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PresentationState>({
    backgroundMediaId: null,
    backgroundUrl: null,
    themeToken: "noir",
  });

  useWsEvent<BackgroundPayload>(
    "game",
    WsEventType.PRESENTATION_SET_BACKGROUND,
    (payload) => {
      setState((prev) => ({
        ...prev,
        backgroundMediaId: payload.mediaId ?? null,
        backgroundUrl: payload.url ?? null,
      }));
    },
  );

  useWsEvent<ThemeColorPayload>(
    "game",
    WsEventType.PRESENTATION_SET_THEME_COLOR,
    (payload) => {
      setState((prev) => ({
        ...prev,
        themeToken: payload.themeToken || "noir",
      }));
    },
  );

  const themeClass = THEME_CLASS[state.themeToken] ?? THEME_CLASS.noir;

  return (
    <div
      className="relative isolate h-screen overflow-hidden bg-slate-950"
      data-presentation-theme={state.themeToken}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 -z-20 bg-gradient-to-br ${themeClass}`}
      />
      {state.backgroundUrl ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center opacity-35"
          style={{ backgroundImage: `url(${state.backgroundUrl})` }}
        />
      ) : null}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-slate-950/45" />
      {children}
    </div>
  );
}

import { lazy, Suspense, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Spinner } from "@/shared/components/ui";
import { EDITOR_TABS } from "@/features/editor/constants";
import type { EditorTab } from "@/features/editor/constants";
import type { EditorThemeResponse } from "@/features/editor/api";
import { useEditorUI } from "@/features/editor/stores/editorUIStore";
import { SaveIndicator } from "./SaveIndicator";
import type { SaveStatus } from "@/features/editor/hooks/useAutoSave";

// ---------------------------------------------------------------------------
// Lazy tab components
// ---------------------------------------------------------------------------

const OverviewTab = lazy(() =>
  import("./OverviewTab").then((m) => ({ default: m.OverviewTab })),
);
const StoryTab = lazy(() =>
  import("./StoryTab").then((m) => ({ default: m.StoryTab })),
);
const CharactersTab = lazy(() =>
  import("./CharactersTab").then((m) => ({ default: m.CharactersTab })),
);
const DesignTab = lazy(() =>
  import("./DesignTab").then((m) => ({ default: m.DesignTab })),
);
const MediaTab = lazy(() =>
  import("./media/MediaTab").then((m) => ({ default: m.MediaTab })),
);
const AdvancedTab = lazy(() =>
  import("./AdvancedTab").then((m) => ({ default: m.AdvancedTab })),
);
const TemplateConfigTab = lazy(() =>
  import("./TemplateConfigTab").then((m) => ({ default: m.TemplateConfigTab })),
);

// ---------------------------------------------------------------------------
// TabContent
// ---------------------------------------------------------------------------

interface TabContentProps {
  tab: EditorTab;
  theme: EditorThemeResponse;
  themeId: string;
}

function TabContent({ tab, theme, themeId }: TabContentProps) {
  switch (tab) {
    case "overview":
      return <OverviewTab theme={theme} themeId={themeId} />;
    case "story":
      return <StoryTab themeId={themeId} />;
    case "characters":
      return <CharactersTab theme={theme} themeId={themeId} />;
    case "design":
      return <DesignTab theme={theme} themeId={themeId} />;
    case "media":
      return <MediaTab themeId={themeId} />;
    case "advanced":
      return <AdvancedTab theme={theme} themeId={themeId} />;
    case "template":
      return <TemplateConfigTab />;
  }
}

// ---------------------------------------------------------------------------
// EditorLayout
// ---------------------------------------------------------------------------

interface EditorLayoutProps {
  theme: EditorThemeResponse;
  themeId: string;
  saveStatus?: SaveStatus;
  lastSaved?: Date | null;
  onSave?: () => void;
  onRetry?: () => void;
  onPublish?: () => void;
  onValidate?: () => void;
}

export function EditorLayout({
  theme,
  themeId,
  saveStatus = "idle",
  lastSaved,
  onSave,
  onRetry,
  onPublish,
  onValidate,
}: EditorLayoutProps) {
  const navigate = useNavigate();
  const { activeTab, setActiveTab } = useEditorUI();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Keyboard navigation: ←→ Home End
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const count = EDITOR_TABS.length;
      let next: number | null = null;

      if (e.key === "ArrowRight") next = (index + 1) % count;
      else if (e.key === "ArrowLeft") next = (index - 1 + count) % count;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = count - 1;

      if (next !== null) {
        e.preventDefault();
        setActiveTab(EDITOR_TABS[next].key);
        tabRefs.current[next]?.focus();
      }
    },
    [setActiveTab],
  );

  // Save on Ctrl+S / Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        onSave?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSave]);

  const tabpanelId = `tabpanel-${activeTab}`;
  const tabId = (key: string) => `tab-${key}`;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900 px-3">
        {/* Back */}
        <button
          type="button"
          onClick={() => navigate("/editor")}
          className="rounded-sm p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
          aria-label="에디터 목록으로 돌아가기"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="h-5 w-px bg-slate-800" />

        {/* Breadcrumb + title */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-xs text-slate-600">에디터</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-700" />
          <span className="truncate text-sm font-mono font-medium text-slate-200">
            {theme.title}
          </span>
          <span className="shrink-0 rounded-sm bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
            {theme.status}
          </span>
        </div>

        {/* Save indicator */}
        <SaveIndicator
          status={saveStatus}
          lastSaved={lastSaved}
          onRetry={onRetry}
        />

        <div className="h-5 w-px bg-slate-800" />

        {/* Actions */}
        <button
          type="button"
          onClick={onValidate}
          className="h-7 rounded-sm border border-slate-700 px-3 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500"
        >
          검증
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={theme.status === "PUBLISHED"}
          className="h-7 rounded-sm bg-amber-600 px-3 text-xs font-medium text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          출판
        </button>
      </header>

      {/* ── Tab nav ── */}
      <nav
        role="tablist"
        aria-label="에디터 탭"
        className="sticky top-12 z-40 flex h-10 shrink-0 border-b border-slate-800 bg-slate-950 px-4"
      >
        {EDITOR_TABS.map((tab, index) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.key}`}
              id={tabId(tab.key)}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.key)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`relative flex items-center gap-1.5 px-4 text-xs font-medium transition-colors ${
                isActive
                  ? "text-amber-400 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-500"
                  : "text-slate-500 hover:bg-slate-900/50 hover:text-slate-300"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* ── Content ── */}
      <div
        role="tabpanel"
        id={tabpanelId}
        aria-labelledby={tabId(activeTab)}
        className="flex-1 overflow-y-auto"
      >
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          }
        >
          <TabContent tab={activeTab} theme={theme} themeId={themeId} />
        </Suspense>
      </div>
    </div>
  );
}

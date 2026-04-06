import { useState, lazy, Suspense } from "react";
import { Spinner } from "@/shared/components/ui";
import { useEditorTheme } from "@/features/editor/api";
import type { EditorThemeResponse } from "@/features/editor/api";
import { EDITOR_TABS } from "@/features/editor/constants";
import type { EditorTab } from "@/features/editor/constants";
import { PublishBar } from "./PublishBar";

// Lazy-load tab components
const OverviewTab = lazy(() =>
  import("./OverviewTab").then((m) => ({ default: m.OverviewTab })),
);
const CharactersTab = lazy(() =>
  import("./CharactersTab").then((m) => ({ default: m.CharactersTab })),
);
const ModulesTab = lazy(() =>
  import("./ModulesTab").then((m) => ({ default: m.ModulesTab })),
);
const ConfigJsonTab = lazy(() =>
  import("./ConfigJsonTab").then((m) => ({ default: m.ConfigJsonTab })),
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
  const fallback = (
    <div className="flex items-center justify-center py-12">
      <Spinner />
    </div>
  );

  switch (tab) {
    case "overview":
      return (
        <Suspense fallback={fallback}>
          <OverviewTab theme={theme} themeId={themeId} />
        </Suspense>
      );
    case "characters":
      return (
        <Suspense fallback={fallback}>
          <CharactersTab theme={theme} themeId={themeId} />
        </Suspense>
      );
    case "modules":
      return (
        <Suspense fallback={fallback}>
          <ModulesTab theme={theme} themeId={themeId} />
        </Suspense>
      );
    case "config":
      return (
        <Suspense fallback={fallback}>
          <ConfigJsonTab theme={theme} themeId={themeId} />
        </Suspense>
      );
  }
}

// ---------------------------------------------------------------------------
// ThemeEditor
// ---------------------------------------------------------------------------

interface ThemeEditorProps {
  themeId: string;
}

export function ThemeEditor({ themeId }: ThemeEditorProps) {
  const { data: theme, isLoading, isError } = useEditorTheme(themeId);
  const [activeTab, setActiveTab] = useState<EditorTab>("overview");

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !theme) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-red-400">
          테마를 찾을 수 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <PublishBar theme={theme} />

      <nav className="mb-6 flex gap-1 border-b border-slate-800">
        {EDITOR_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-amber-500 text-amber-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <TabContent tab={activeTab} theme={theme} themeId={themeId} />
    </div>
  );
}

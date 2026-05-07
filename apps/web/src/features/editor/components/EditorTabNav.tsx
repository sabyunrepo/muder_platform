import { Fragment, useRef, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import { EDITOR_TABS, type EditorTab } from "@/features/editor/constants";
import { buildEditorRouteForTab } from "@/features/editor/routeSegments";
import { useEditorUI } from "@/features/editor/stores/editorUIStore";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

const EMPTY_MODULES: string[] = [];

interface EditorTabNavProps {
  themeId?: string;
  activeModules?: string[];
  forcedVisibleTab?: EditorTab;
}

// ---------------------------------------------------------------------------
// EditorTabNav — scrollable tab navigation bar with dynamic filtering
// ---------------------------------------------------------------------------

export function EditorTabNav({
  themeId,
  activeModules = EMPTY_MODULES,
  forcedVisibleTab,
}: EditorTabNavProps) {
  const navigate = useNavigate();
  const { activeTab, setActiveTab } = useEditorUI();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const visibleTabs = useMemo(
    () =>
      EDITOR_TABS.filter(
        (tab) =>
          tab.always ||
          tab.key === forcedVisibleTab ||
          activeModules.includes(tab.requiredModule ?? ""),
      ),
    [activeModules, forcedVisibleTab],
  );

  // If active tab is now hidden, fallback to the creator's main story workspace.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.key === activeTab)) {
      setActiveTab("storyMap");
      if (themeId) {
        navigate(buildEditorRouteForTab(themeId, "storyMap"));
      }
    }
  }, [visibleTabs, activeTab, setActiveTab, themeId, navigate]);

  useEffect(() => {
    const activeIndex = visibleTabs.findIndex((tab) => tab.key === activeTab);
    tabRefs.current[activeIndex]?.scrollIntoView?.({
      block: "nearest",
      inline: "center",
    });
  }, [activeTab, visibleTabs]);

  const selectTab = useCallback(
    (tab: EditorTab) => {
      setActiveTab(tab);
      if (themeId) {
        navigate(buildEditorRouteForTab(themeId, tab));
      }
    },
    [navigate, setActiveTab, themeId],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const count = visibleTabs.length;
      let next: number | null = null;

      if (e.key === "ArrowRight") next = (index + 1) % count;
      else if (e.key === "ArrowLeft") next = (index - 1 + count) % count;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = count - 1;

      if (next !== null) {
        e.preventDefault();
        selectTab(visibleTabs[next].key);
        tabRefs.current[next]?.focus();
      }
    },
    [selectTab, visibleTabs],
  );

  return (
    <div className="sticky top-12 z-40 h-11 shrink-0 border-b border-slate-800 bg-slate-950">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-slate-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-slate-950 to-transparent" />
      <nav
        role="tablist"
        aria-label="에디터 탭"
        className="flex h-full overflow-x-auto px-2 [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden"
      >
        {visibleTabs.map((tab, index) => {
          const isActive = activeTab === tab.key;
          const startsNewGroup = index > 0 && visibleTabs[index - 1]?.group !== tab.group;
          return (
            <Fragment key={tab.key}>
              {startsNewGroup && (
                <div
                  aria-hidden="true"
                  className="my-2 mr-2 w-px bg-slate-800"
                />
              )}
              <button
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.key}`}
                id={`tab-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => selectTab(tab.key)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className={`relative flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-xs font-medium transition-colors sm:px-4 ${
                  isActive
                    ? "text-amber-400 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-500"
                    : "text-slate-500 hover:bg-slate-900/50 hover:text-slate-300"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            </Fragment>
          );
        })}
      </nav>
    </div>
  );
}

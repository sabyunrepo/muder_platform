import { lazy } from "react";
import type { EditorTab } from "@/features/editor/constants";
import type { EditorThemeResponse } from "@/features/editor/api";

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
const CluesTab = lazy(() =>
  import("./CluesTab").then((m) => ({ default: m.CluesTab })),
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
  routeSegment?: string;
}

export function TabContent({ tab, theme, themeId, routeSegment }: TabContentProps) {
  switch (tab) {
    case "overview":
      return <OverviewTab theme={theme} themeId={themeId} />;
    case "story":
      return <StoryTab themeId={themeId} />;
    case "characters":
      return <CharactersTab theme={theme} themeId={themeId} />;
    case "clues":
      return <CluesTab themeId={themeId} routeSegment={routeSegment} />;
    case "design":
      return <DesignTab theme={theme} themeId={themeId} routeSegment={routeSegment} />;
    case "media":
      return <MediaTab themeId={themeId} />;
    case "advanced":
      return <AdvancedTab theme={theme} themeId={themeId} />;
    case "template":
      return <TemplateConfigTab />;
  }
}

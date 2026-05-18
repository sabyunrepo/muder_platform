import { useEffect } from "react";
import { useLocation, useParams } from "react-router";
import { EditorDashboard } from "@/features/editor/components";
import { ThemeEditor } from "@/features/editor/components";
import "@/features/editor/design-system/editorNotionTheme.css";
import { EDITOR_DESIGN_SCOPE_CLASS } from "@/features/editor/design-system/editorDesignTokens";
import { readEditorTabFromRouteSegment } from "@/features/editor/routeSegments";
import { useEditorUI } from "@/features/editor/stores/editorUIStore";

export default function EditorPage() {
  const { id } = useParams<{
    id: string;
  }>();
  const location = useLocation();
  const setActiveTab = useEditorUI((state) => state.setActiveTab);
  const routeSegment = location.pathname.split("/").filter(Boolean).slice(2).join("/") || undefined;
  const activeTabRouteSegment = routeSegment;

  useEffect(() => {
    setActiveTab(readEditorTabFromRouteSegment(activeTabRouteSegment));
  }, [setActiveTab, activeTabRouteSegment]);

  if (id) {
    return (
      <div className={EDITOR_DESIGN_SCOPE_CLASS}>
        <ThemeEditor themeId={id} routeSegment={routeSegment} />
      </div>
    );
  }

  return (
    <div className={EDITOR_DESIGN_SCOPE_CLASS}>
      <EditorDashboard />
    </div>
  );
}

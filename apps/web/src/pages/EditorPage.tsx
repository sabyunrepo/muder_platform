import { useEffect } from "react";
import { useLocation, useParams } from "react-router";
import { EditorDashboard } from "@/features/editor/components";
import { ThemeEditor } from "@/features/editor/components";
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
    return <ThemeEditor themeId={id} routeSegment={routeSegment} />;
  }

  return <EditorDashboard />;
}

import { useEffect } from "react";
import { useParams } from "react-router";
import { EditorDashboard } from "@/features/editor/components";
import { ThemeEditor } from "@/features/editor/components";
import { readEditorTabFromRouteSegment } from "@/features/editor/routeSegments";
import { useEditorUI } from "@/features/editor/stores/editorUIStore";

export default function EditorPage() {
  const { id, tab, designTab } = useParams<{
    id: string;
    tab?: string;
    designTab?: string;
  }>();
  const setActiveTab = useEditorUI((state) => state.setActiveTab);
  const routeSegment = designTab ?? tab;

  useEffect(() => {
    setActiveTab(readEditorTabFromRouteSegment(routeSegment));
  }, [setActiveTab, routeSegment]);

  if (id) {
    return <ThemeEditor themeId={id} routeSegment={routeSegment} />;
  }

  return <EditorDashboard />;
}

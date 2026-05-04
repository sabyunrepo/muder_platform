import { useEffect } from "react";
import { useParams } from "react-router";
import { EditorDashboard } from "@/features/editor/components";
import { ThemeEditor } from "@/features/editor/components";
import { readEditorTabFromRouteSegment } from "@/features/editor/routeSegments";
import { useEditorUI } from "@/features/editor/stores/editorUIStore";

export default function EditorPage() {
  const { id, tab } = useParams<{ id: string; tab?: string }>();
  const setActiveTab = useEditorUI((state) => state.setActiveTab);

  useEffect(() => {
    setActiveTab(readEditorTabFromRouteSegment(tab));
  }, [setActiveTab, tab]);

  if (id) {
    return <ThemeEditor themeId={id} routeSegment={tab} />;
  }

  return <EditorDashboard />;
}

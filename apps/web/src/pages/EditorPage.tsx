import { useEffect } from "react";
import { useParams } from "react-router";
import { EditorDashboard } from "@/features/editor/components";
import { ThemeEditor } from "@/features/editor/components";
import type { EditorTab } from "@/features/editor/constants";
import { useEditorUI } from "@/features/editor/stores/editorUIStore";

const TAB_SEGMENT_MAP: Record<string, EditorTab> = {
  characters: "characters",
  clues: "clues",
  relations: "clues",
  modules: "design",
  flow: "design",
  locations: "design",
  templates: "template",
  template: "template",
};

export default function EditorPage() {
  const { id, tab } = useParams<{ id: string; tab?: string }>();
  const setActiveTab = useEditorUI((state) => state.setActiveTab);

  useEffect(() => {
    if (!tab) return;
    const nextTab = TAB_SEGMENT_MAP[tab];
    if (nextTab) setActiveTab(nextTab);
  }, [setActiveTab, tab]);

  if (id) {
    return <ThemeEditor themeId={id} routeSegment={tab} />;
  }

  return <EditorDashboard />;
}

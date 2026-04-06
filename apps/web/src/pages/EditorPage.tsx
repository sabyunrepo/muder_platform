import { useParams } from "react-router";
import { EditorDashboard } from "@/features/editor/components";
import { ThemeEditor } from "@/features/editor/components";

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();

  if (id) {
    return <ThemeEditor themeId={id} />;
  }

  return <EditorDashboard />;
}

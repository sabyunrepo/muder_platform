import { useParams } from "react-router";
import { ThemeStats } from "@/features/creator/components/ThemeStats";

export default function CreatorThemeStatsPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-sm text-red-400">테마 ID가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <ThemeStats themeId={id} />
    </div>
  );
}

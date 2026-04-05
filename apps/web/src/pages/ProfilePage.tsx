import { AlertCircle, RefreshCw } from "lucide-react";
import { useProfile } from "@/features/profile/api";
import { ProfileForm, ProfileStats } from "@/features/profile/components";
import { Button, Spinner, Badge } from "@/shared/components/ui";

// ---------------------------------------------------------------------------
// ProfilePage — 내 프로필
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const { data, isLoading, isError, error, refetch } = useProfile();

  // 로딩
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // 에러
  if (isError || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 text-slate-400">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p>{error?.message ?? "프로필을 불러올 수 없습니다."}</p>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className="h-4 w-4" />}
          onClick={() => refetch()}
        >
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-100">프로필</h1>
        <Badge
          variant={
            data.role === "admin"
              ? "danger"
              : data.role === "creator"
                ? "warning"
                : "default"
          }
        >
          {data.role}
        </Badge>
      </div>

      {/* 프로필 편집 폼 */}
      <ProfileForm
        nickname={data.nickname}
        email={data.email}
        profileImage={data.profile_image}
        role={data.role}
        provider={data.provider}
      />

      {/* 통계 */}
      <ProfileStats
        totalGames={data.total_games}
        winCount={data.win_count}
        createdAt={data.created_at}
      />
    </div>
  );
}

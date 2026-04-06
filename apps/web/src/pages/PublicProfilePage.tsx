import { useParams } from "react-router";
import { AlertCircle, RefreshCw, User as UserIcon, Calendar } from "lucide-react";
import { usePublicProfile } from "@/features/profile/api";
import { ProfileStats } from "@/features/profile/components";
import { Button, Card, Spinner } from "@/shared/components/ui";

// ---------------------------------------------------------------------------
// 날짜 포맷
// ---------------------------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatDate(iso: string): string {
  try {
    return dateFormatter.format(new Date(iso));
  } catch {
    return "-";
  }
}

// ---------------------------------------------------------------------------
// PublicProfilePage — 공개 프로필
// ---------------------------------------------------------------------------

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = usePublicProfile(
    id ?? "",
  );

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
      {/* 헤더: 아바타 + 닉네임 + 가입일 */}
      <Card className="flex items-center gap-5 p-6">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 border border-slate-700">
          {data.avatar_url ? (
            <img
              src={data.avatar_url}
              alt={data.nickname}
              className="h-full w-full object-cover"
            />
          ) : (
            <UserIcon className="h-10 w-10 text-slate-500" />
          )}
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-100">
            {data.nickname}
          </h1>
          {data.bio && (
            <p className="text-sm text-slate-400">{data.bio}</p>
          )}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatDate(data.created_at)} 가입</span>
          </div>
        </div>
      </Card>

      {/* 통계 */}
      <ProfileStats
        totalGames={data.total_games}
        winCount={data.win_count}
        createdAt={data.created_at}
      />
    </div>
  );
}

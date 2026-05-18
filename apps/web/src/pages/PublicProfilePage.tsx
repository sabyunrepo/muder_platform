import { useParams } from 'react-router';
import { RefreshCw, User as UserIcon, Calendar } from 'lucide-react';
import { usePublicProfile } from '@/features/profile/api';
import { ProfileStats } from '@/features/profile/components';
import { Alert, Button, Card, LoadingState, PageShell, Panel } from '@/shared/components/ui';

// ---------------------------------------------------------------------------
// 날짜 포맷
// ---------------------------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

function formatDate(iso: string): string {
  try {
    return dateFormatter.format(new Date(iso));
  } catch {
    return '-';
  }
}

// ---------------------------------------------------------------------------
// PublicProfilePage — 공개 프로필
// ---------------------------------------------------------------------------

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = usePublicProfile(id ?? '');

  // 로딩
  if (isLoading) {
    return <LoadingState label="프로필을 불러오는 중" className="py-20" />;
  }

  // 에러
  if (isError || !data) {
    return (
      <Panel className="mx-auto max-w-2xl">
        <Alert
          variant="error"
          title="프로필을 불러오지 못했습니다"
          description={error?.message ?? '잠시 후 다시 시도해주세요.'}
        />
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          leftIcon={<RefreshCw className="h-4 w-4" />}
          onClick={() => refetch()}
        >
          다시 시도
        </Button>
      </Panel>
    );
  }

  return (
    <PageShell className="min-h-0">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        {/* 헤더: 아바타 + 닉네임 + 가입일 */}
        <Card className="flex items-center gap-5 p-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface-soft)]">
            {data.avatar_url ? (
              <img
                src={data.avatar_url}
                alt={data.nickname}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserIcon className="h-10 w-10 text-[var(--mmp-color-muted)]" />
            )}
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-[var(--mmp-color-ink)]">{data.nickname}</h1>
            {data.bio && <p className="text-sm text-[var(--mmp-color-steel)]">{data.bio}</p>}
            <div className="flex items-center gap-1.5 text-xs text-[var(--mmp-color-muted)]">
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
    </PageShell>
  );
}

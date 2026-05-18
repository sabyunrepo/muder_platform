import { RefreshCw } from 'lucide-react';
import { useProfile } from '@/features/profile/api';
import {
  ProfileForm,
  ProfileStats,
  NotificationSettings,
  DangerZone,
} from '@/features/profile/components';
import {
  Alert,
  Badge,
  Button,
  LoadingState,
  PageShell,
  Panel,
  SectionHeader,
} from '@/shared/components/ui';

// ---------------------------------------------------------------------------
// ProfilePage — 내 프로필
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const { data, isLoading, isError, error, refetch } = useProfile();

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
    <PageShell
      header={
        <div className="flex items-center gap-3">
          <SectionHeader title="프로필" />
          <Badge
            variant={
              data.role === 'admin' ? 'danger' : data.role === 'creator' ? 'warning' : 'default'
            }
          >
            {data.role}
          </Badge>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-2xl space-y-8">
        {/* 프로필 편집 폼 */}
        <ProfileForm
          nickname={data.nickname}
          email={data.email}
          profileImage={data.avatar_url}
          provider={data.provider}
        />

        {/* 통계 */}
        <ProfileStats
          totalGames={data.total_games}
          winCount={data.win_count}
          createdAt={data.created_at}
        />

        {/* 알림 설정 */}
        <section>
          <Panel padding="lg">
            <SectionHeader title="알림 설정" className="mb-4" />
            <NotificationSettings />
          </Panel>
        </section>

        {/* 위험 구역 */}
        <DangerZone />
      </div>
    </PageShell>
  );
}

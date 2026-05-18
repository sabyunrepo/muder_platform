import { useParams } from 'react-router';
import { ThemeStats } from '@/features/creator/components/ThemeStats';
import { Alert, PageShell, Panel, SectionHeader } from '@/shared/components/ui';

export default function CreatorThemeStatsPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <PageShell>
        <Panel>
          <Alert variant="error" title="테마 ID가 없습니다." />
        </Panel>
      </PageShell>
    );
  }

  return (
    <PageShell header={<SectionHeader title="테마 통계" />}>
      <ThemeStats themeId={id} />
    </PageShell>
  );
}

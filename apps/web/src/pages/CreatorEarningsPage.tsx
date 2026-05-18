import { EarningsList } from '@/features/creator/components/EarningsList';
import { PageShell, SectionHeader } from '@/shared/components/ui';

export default function CreatorEarningsPage() {
  return (
    <PageShell header={<SectionHeader title="수익 내역" />}>
      <EarningsList />
    </PageShell>
  );
}

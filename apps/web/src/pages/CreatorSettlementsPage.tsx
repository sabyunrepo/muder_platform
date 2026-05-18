import { SettlementList } from '@/features/creator/components/SettlementList';
import { PageShell, SectionHeader } from '@/shared/components/ui';

export default function CreatorSettlementsPage() {
  return (
    <PageShell header={<SectionHeader title="정산 내역" />}>
      <SettlementList />
    </PageShell>
  );
}

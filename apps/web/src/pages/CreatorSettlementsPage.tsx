import { SettlementList } from '@/features/creator/components/SettlementList';
import { PageShell, SectionHeader } from '@/shared/components/ui';

export default function CreatorSettlementsPage() {
  return (
    <PageShell className="min-h-0" header={<SectionHeader title="정산 내역" />}>
      <SettlementList />
    </PageShell>
  );
}

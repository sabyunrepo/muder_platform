import { AdminSettlements } from '@/features/admin/components/AdminSettlements';
import { PageShell } from '@/shared/components/ui';

export default function AdminSettlementsPage() {
  return (
    <PageShell className="min-h-0">
      <AdminSettlements />
    </PageShell>
  );
}

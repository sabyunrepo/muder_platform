import { AdminRevenue } from '@/features/admin/components/AdminRevenue';
import { PageShell } from '@/shared/components/ui';

export default function AdminRevenuePage() {
  return (
    <PageShell className="min-h-0">
      <AdminRevenue />
    </PageShell>
  );
}

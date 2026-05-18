import { AdminCoinGrant } from '@/features/admin/components/AdminCoinGrant';
import { PageShell } from '@/shared/components/ui';

export default function AdminCoinGrantPage() {
  return (
    <PageShell className="min-h-0">
      <AdminCoinGrant />
    </PageShell>
  );
}

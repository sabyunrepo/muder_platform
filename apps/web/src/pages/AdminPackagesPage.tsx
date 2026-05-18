import { AdminPackages } from '@/features/admin/components/AdminPackages';
import { PageShell } from '@/shared/components/ui';

export default function AdminPackagesPage() {
  return (
    <PageShell className="min-h-0">
      <AdminPackages />
    </PageShell>
  );
}

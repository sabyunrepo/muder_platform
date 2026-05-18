import { CreatorDashboard } from '@/features/creator/components/CreatorDashboard';
import { PageShell } from '@/shared/components/ui';

export default function CreatorDashboardPage() {
  return (
    <PageShell className="min-h-0">
      <CreatorDashboard />
    </PageShell>
  );
}

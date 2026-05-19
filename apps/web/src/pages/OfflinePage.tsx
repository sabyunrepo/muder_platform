import { WifiOff } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { PublicThemeShell } from '@/shared/components/PublicThemeShell';

export default function OfflinePage() {
  return (
    <PublicThemeShell center>
      <section className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] px-8 py-10 text-center shadow-[var(--mmp-shadow-card)]">
        <WifiOff className="h-16 w-16 text-[var(--mmp-color-muted)]" />
        <h1 className="text-xl font-semibold text-[var(--mmp-color-ink)]">연결이 끊어졌습니다</h1>
        <p className="text-sm text-[var(--mmp-color-steel)]">네트워크 연결을 확인해주세요</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          재시도
        </Button>
      </section>
    </PublicThemeShell>
  );
}

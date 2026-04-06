import { WifiOff } from 'lucide-react';
import { Button } from '@/shared/components/ui';

export default function OfflinePage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-950">
      <WifiOff className="h-16 w-16 text-slate-500" />
      <h1 className="text-xl text-slate-200">연결이 끊어졌습니다</h1>
      <p className="text-sm text-slate-400">네트워크 연결을 확인해주세요</p>
      <Button
        variant="secondary"
        onClick={() => window.location.reload()}
      >
        재시도
      </Button>
    </div>
  );
}

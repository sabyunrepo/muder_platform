import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { Button, Spinner } from '@/shared/components/ui';

export function NetworkOverlay() {
  const status = useNetworkStatus();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== 'offline') {
      setElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1_000);

    return () => clearInterval(interval);
  }, [status]);

  if (status !== 'offline') return null;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeDisplay =
    minutes > 0
      ? `${minutes}분 ${seconds.toString().padStart(2, '0')}초`
      : `${seconds}초`;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/80 flex flex-col items-center justify-center gap-4 motion-safe:animate-fade-in">
      <WifiOff className="h-12 w-12 text-slate-400" />
      <p className="text-sm text-slate-300">재연결 중...</p>
      <Spinner size="md" />
      <p className="text-xs text-slate-500">{timeDisplay} 경과</p>

      {elapsed >= 30 && (
        <div className="flex flex-col items-center gap-3">
          {elapsed >= 60 && (
            <p className="text-xs text-slate-400">
              게임이 종료되었을 수 있습니다
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.location.reload()}
            >
              다시 연결하기
            </Button>
            {elapsed >= 60 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  window.location.href = '/lobby';
                }}
              >
                로비로 돌아가기
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

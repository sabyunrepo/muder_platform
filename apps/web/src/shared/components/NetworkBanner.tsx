import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';

export function NetworkBanner() {
  const status = useNetworkStatus();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (status === 'offline') {
      setVisible(true);
      setExiting(false);
    } else if (status === 'recovered') {
      setVisible(true);
      setExiting(false);
      const timer = setTimeout(() => {
        setExiting(true);
      }, 2_700);
      return () => clearTimeout(timer);
    } else {
      // online — hide after exit animation
      if (exiting) {
        const timer = setTimeout(() => {
          setVisible(false);
          setExiting(false);
        }, 300);
        return () => clearTimeout(timer);
      }
      setVisible(false);
    }
  }, [status, exiting]);

  if (!visible) return null;

  const isOffline = status === 'offline';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed top-0 z-[60] flex h-10 w-full items-center justify-center gap-2 border-b px-4 text-sm font-medium shadow-[var(--mmp-shadow-card)] backdrop-blur-sm ${
        isOffline
          ? 'border-[var(--mmp-color-error)] bg-[var(--mmp-color-error)] text-white'
          : 'border-[var(--mmp-color-success)] bg-[var(--mmp-color-success)] text-white'
      } ${exiting ? 'motion-safe:animate-slide-out-top' : 'motion-safe:animate-slide-in-top'}`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {isOffline ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span>연결이 끊어졌습니다</span>
        </>
      ) : (
        <>
          <Wifi className="h-4 w-4" />
          <span>다시 연결되었습니다</span>
        </>
      )}
    </div>
  );
}

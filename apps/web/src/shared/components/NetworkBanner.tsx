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
      className={`fixed top-0 w-full z-[60] h-10 flex items-center justify-center gap-2 backdrop-blur-sm ${
        isOffline ? 'bg-red-900/90' : 'bg-emerald-900/90'
      } ${exiting ? 'motion-safe:animate-slide-out-top' : 'motion-safe:animate-slide-in-top'}`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {isOffline ? (
        <>
          <WifiOff className="h-4 w-4 text-red-200" />
          <span className="text-red-200 text-sm font-medium">
            연결이 끊어졌습니다
          </span>
        </>
      ) : (
        <>
          <Wifi className="h-4 w-4 text-emerald-200" />
          <span className="text-emerald-200 text-sm font-medium">
            다시 연결되었습니다
          </span>
        </>
      )}
    </div>
  );
}

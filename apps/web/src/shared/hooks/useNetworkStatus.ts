import { useEffect, useRef, useState } from 'react';

export type NetworkState = 'online' | 'offline' | 'recovered';

export function useNetworkStatus(): NetworkState {
  const [state, setState] = useState<NetworkState>(
    navigator.onLine ? 'online' : 'offline',
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleOffline() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setState('offline');
    }

    function handleOnline() {
      setState('recovered');
      timerRef.current = setTimeout(() => {
        setState('online');
        timerRef.current = null;
      }, 3_000);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return state;
}

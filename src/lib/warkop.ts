import { useCallback, useEffect, useState } from 'react';
import { getWarkopStatus } from './api';

export type WarkopStatus = 'buka' | 'tutup';

export function useWarkopStatus(pollMs = 20000) {
  const [status, setStatus] = useState<WarkopStatus | null>(null);
  const refresh = useCallback(async () => {
    try {
      const s = await getWarkopStatus();
      setStatus(s);
    } catch {
      // Biarkan status terakhir, jangan blokir katalog saat server tidak terjangkau.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [refresh, pollMs]);

  return { status, refresh };
}

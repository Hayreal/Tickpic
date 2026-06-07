import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppLogEntry } from '../shared/domain/appLog';
import type { createDesktopClient } from '../infrastructure/desktop/desktopClient';

const MAX_VISIBLE_LOGS = 500;

type DesktopClient = ReturnType<typeof createDesktopClient>;

export function useAppLogs(desktop: DesktopClient | undefined) {
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!desktop?.isAvailable()) {
      setLogs([]);
      return;
    }

    setIsLoading(true);
    try {
      const entries = await desktop.logs.list();
      if (mountedRef.current) {
        setLogs(entries.slice(-MAX_VISIBLE_LOGS));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [desktop]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    if (!desktop?.isAvailable()) {
      return () => {
        mountedRef.current = false;
      };
    }

    const unsubscribe = desktop.logs.onEntry((entry) => {
      setLogs((prev) => [...prev.slice(-(MAX_VISIBLE_LOGS - 1)), entry]);
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [desktop, refresh]);

  return { logs, isLoading, refresh };
}

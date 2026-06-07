import type { AppLogEntry, AppLogLevel, AppLogSource } from '../../../../src/shared/domain/appLog.js';
import { formatLogDetails } from './sanitizeLog.js';

const MAX_ENTRIES = 500;

export type AppLogListener = (entry: AppLogEntry) => void;

export interface AppLogger {
  info(source: AppLogSource, message: string, details?: unknown): AppLogEntry;
  warn(source: AppLogSource, message: string, details?: unknown): AppLogEntry;
  error(source: AppLogSource, message: string, details?: unknown): AppLogEntry;
  list(): AppLogEntry[];
  subscribe(listener: AppLogListener): () => void;
}

let sharedLogger: AppLogger | undefined;

export function createAppLogger(): AppLogger {
  const entries: AppLogEntry[] = [];
  const listeners = new Set<AppLogListener>();

  function append(level: AppLogLevel, source: AppLogSource, message: string, details?: unknown) {
    const entry: AppLogEntry = {
      id: `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      details: formatLogDetails(details),
    };

    entries.push(entry);
    if (entries.length > MAX_ENTRIES) {
      entries.splice(0, entries.length - MAX_ENTRIES);
    }

    const prefix = `[${source}]`;
    const consoleMessage = `${prefix} ${message}`;
    if (level === 'error') {
      console.error(consoleMessage, entry.details ?? '');
    } else if (level === 'warn') {
      console.warn(consoleMessage, entry.details ?? '');
    } else {
      console.log(consoleMessage, entry.details ?? '');
    }

    for (const listener of listeners) {
      listener(entry);
    }

    return entry;
  }

  return {
    info(source, message, details) {
      return append('info', source, message, details);
    },
    warn(source, message, details) {
      return append('warn', source, message, details);
    },
    error(source, message, details) {
      return append('error', source, message, details);
    },
    list() {
      return [...entries];
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function getAppLogger(): AppLogger {
  if (!sharedLogger) {
    sharedLogger = createAppLogger();
  }
  return sharedLogger;
}

export function resetAppLoggerForTests() {
  sharedLogger = undefined;
}

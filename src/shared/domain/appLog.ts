export type AppLogLevel = 'info' | 'warn' | 'error';

export type AppLogSource =
  | 'app'
  | 'task'
  | 'image-task'
  | 'settings'
  | 'storage'
  | 'model';

export interface AppLogEntry {
  id: string;
  timestamp: string;
  level: AppLogLevel;
  source: AppLogSource;
  message: string;
  details?: string;
}

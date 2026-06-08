import type { AppLogEntry, AppLogLevel } from '../shared/domain/appLog';

export const LOG_SOURCE_LABELS: Record<AppLogEntry['source'], string> = {
  app: '应用',
  task: '任务',
  'image-task': '作图',
  settings: '设置',
  storage: '存储',
  model: '模型',
};

export function formatLogTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleTimeString('zh-CN', { hour12: false });
}

export function logLevelClass(level: AppLogLevel) {
  switch (level) {
    case 'error':
      return 'text-red-600';
    case 'warn':
      return 'text-amber-600';
    default:
      return 'text-muted-foreground';
  }
}

export function formatAppLogEntryText(entry: AppLogEntry) {
  const lines = [
    `${formatLogTime(entry.timestamp)} [${LOG_SOURCE_LABELS[entry.source]}] ${entry.level.toUpperCase()} ${entry.message}`,
  ];

  if (entry.details) {
    lines.push(entry.details);
  }

  return lines.join('\n');
}

export function formatAppLogEntriesText(entries: AppLogEntry[]) {
  return entries.map((entry) => formatAppLogEntryText(entry)).join('\n\n');
}

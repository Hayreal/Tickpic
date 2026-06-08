import { useCallback, type RefObject } from 'react';
import { Copy } from 'lucide-react';
import type { AppLogEntry } from '../shared/domain/appLog';
import {
  LOG_SOURCE_LABELS,
  formatAppLogEntriesText,
  formatAppLogEntryText,
  formatLogTime,
  logLevelClass,
} from '../lib/appLogPresentation';
import { copyTextToClipboard } from '../lib/copyTextToClipboard';
import { Badge } from '@/src/components/ui/badge';
import { cn } from '@/src/lib/utils';

interface AppLogListProps {
  logs: AppLogEntry[];
  isLoading?: boolean;
  emptyText?: string;
  viewportClassName?: string;
  logsEndRef?: RefObject<HTMLDivElement | null>;
}

export default function AppLogList({
  logs,
  isLoading = false,
  emptyText = '暂无日志',
  viewportClassName,
  logsEndRef,
}: AppLogListProps) {
  const handleCopyEntry = useCallback(async (entry: AppLogEntry) => {
    try {
      await copyTextToClipboard(formatAppLogEntryText(entry));
    } catch (err) {
      const message = err instanceof Error ? err.message : '复制日志失败';
      alert(message);
    }
  }, []);

  const handleCopyAll = useCallback(async () => {
    try {
      await copyTextToClipboard(formatAppLogEntriesText(logs));
    } catch (err) {
      const message = err instanceof Error ? err.message : '复制日志失败';
      alert(message);
    }
  }, [logs]);

  return (
    <div className={cn('overflow-y-auto bg-muted/20 font-mono text-xs leading-relaxed', viewportClassName)}>
      {isLoading && logs.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          正在加载日志...
        </div>
      ) : logs.length === 0 ? (
        <div className="flex h-32 items-center justify-center px-4 text-center text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          <div className="flex items-center justify-end px-4 py-2">
            <button
              type="button"
              onClick={() => void handleCopyAll()}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-accent"
            >
              <Copy className="size-3.5" />
              复制全部
            </button>
          </div>
          {logs.map((entry) => (
            <div key={entry.id} className="group px-4 py-2 hover:bg-muted/40">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-muted-foreground">{formatLogTime(entry.timestamp)}</span>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                    {LOG_SOURCE_LABELS[entry.source]}
                  </Badge>
                  <span className={cn('uppercase font-semibold', logLevelClass(entry.level))}>
                    {entry.level}
                  </span>
                  <span className="text-foreground">{entry.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyEntry(entry)}
                  className="cursor-pointer shrink-0 rounded-md border border-transparent p-1 text-muted-foreground opacity-0 transition-opacity hover:border-border hover:bg-background hover:text-foreground group-hover:opacity-100"
                  title="复制日志"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
              {entry.details ? (
                <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                  {entry.details}
                </pre>
              ) : null}
            </div>
          ))}
          {logsEndRef ? <div ref={logsEndRef} /> : null}
        </div>
      )}
    </div>
  );
}

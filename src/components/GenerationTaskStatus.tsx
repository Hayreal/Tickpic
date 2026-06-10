import { useEffect, useMemo, useRef } from 'react';
import { Cpu, ScrollText } from 'lucide-react';
import type { AppLogEntry } from '../shared/domain/appLog';
import type { ImageTaskRecord } from '../shared/domain/imageFeatureApi';
import { getSharedOutputBatchId } from '../features/tasks/taskBatchGrouping';
import {
  formatTaskBatchProgress,
  formatTaskProgress,
  getTaskBatchProgress,
  getTaskProgress,
  isTaskBatchInProgress,
  isTaskInProgress,
} from '../features/tasks/taskProgress';
import AppLogList from './AppLogList';
import { Badge } from '@/src/components/ui/badge';
import { cn } from '@/src/lib/utils';

function statusLabel(status: ImageTaskRecord['status']) {
  switch (status) {
    case 'queued':
      return '排队中';
    case 'running':
      return '生成中';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    case 'canceled':
      return '已取消';
    default:
      return status;
  }
}

function summarizeTasks(tasks: ImageTaskRecord[]) {
  return tasks.reduce<Record<ImageTaskRecord['status'], number>>((counts, task) => {
    counts[task.status] = (counts[task.status] ?? 0) + 1;
    return counts;
  }, {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    canceled: 0,
  });
}

function buildStatusHeadline(tasks: ImageTaskRecord[], sharedBatchId: string | null) {
  if (tasks.length === 0) {
    return '等待提交生成任务';
  }

  const summary = summarizeTasks(tasks);
  if (sharedBatchId) {
    if (summary.running > 0) {
      return `批量任务生成中 · ${tasks.length} 项`;
    }
    if (summary.queued > 0) {
      return `批量任务排队中 · ${tasks.length} 项`;
    }
    if (summary.failed > 0 && summary.completed === 0) {
      return `批量任务失败 · ${tasks.length} 项`;
    }
    if (summary.completed > 0 && summary.failed === 0) {
      return `批量任务已完成 · ${tasks.length} 项`;
    }
    if (summary.failed > 0) {
      return `批量任务部分失败 · ${tasks.length} 项`;
    }
    return `批量任务状态已更新 · ${tasks.length} 项`;
  }

  if (summary.running > 0) {
    return summary.running === 1 ? 'AI 模型正在生成' : `${summary.running} 个任务正在生成`;
  }
  if (summary.queued > 0) {
    return summary.queued === 1 ? '任务排队中' : `${summary.queued} 个任务排队中`;
  }
  if (summary.failed > 0 && summary.completed === 0) {
    return '任务执行失败';
  }
  if (summary.completed > 0 && summary.failed === 0) {
    return summary.completed === 1 ? '任务已完成' : `${summary.completed} 个任务已完成`;
  }
  if (summary.failed > 0) {
    return '部分任务失败';
  }
  return '任务状态已更新';
}

interface GenerationTaskStatusProps {
  tasks: ImageTaskRecord[];
  fallbackCount: number;
  error?: string | null;
  logs: AppLogEntry[];
  isLoadingLogs?: boolean;
  compact?: boolean;
}

export default function GenerationTaskStatus({
  tasks,
  fallbackCount,
  error,
  logs,
  isLoadingLogs = false,
  compact = false,
}: GenerationTaskStatusProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const inProgress = tasks.length > 1
    ? isTaskBatchInProgress(tasks)
    : isTaskInProgress(tasks[0] ?? null);
  const progress = tasks.length > 1
    ? getTaskBatchProgress(tasks, fallbackCount)
    : getTaskProgress(tasks[0] ?? null, fallbackCount);
  const progressLabel = tasks.length > 1
    ? formatTaskBatchProgress(tasks, fallbackCount)
    : formatTaskProgress(tasks[0] ?? null, fallbackCount);
  const progressPercent = Math.max(
    tasks[0]?.status === 'queued' && tasks.length === 1 ? 10 : 0,
    (progress.completed / Math.max(progress.total, 1)) * 100,
  );
  const warnings = useMemo(
    () => tasks.flatMap((task) => task.warnings ?? []),
    [tasks],
  );
  const sharedBatchId = getSharedOutputBatchId(tasks);
  const headline = buildStatusHeadline(tasks, sharedBatchId);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [logs.length]);

  const showLogs = tasks.length > 0 || logs.length > 0 || isLoadingLogs;

  return (
    <div className={cn(compact ? 'mb-3 space-y-3' : 'mb-6 space-y-4')} id="generation-task-status">
      {(tasks.length > 0 || error) && (
        <div
          className={cn(
            compact ? 'rounded-lg border bg-card p-3 shadow-sm' : 'rounded-lg border bg-card p-4 shadow-sm',
            inProgress ? 'border-primary/10 animate-pulse' : 'border-border',
          )}
          id="generation-progress-box"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {inProgress ? <Cpu className="size-4 shrink-0 text-muted-foreground animate-spin" /> : null}
                <span>{headline}</span>
              </div>
              {tasks.length > 0 ? (
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  进度 {progressLabel}
                </p>
              ) : null}
            </div>
            {sharedBatchId ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="font-mono text-[10px]">
                  批量 · {tasks.length} 项
                </Badge>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {sharedBatchId.slice(0, 8)}
                </Badge>
              </div>
            ) : tasks.length > 1 ? (
              <div className="flex flex-wrap gap-1.5">
                {tasks.map((task) => (
                  <Badge key={task.taskId} variant="outline" className="font-mono text-[10px]">
                    {task.taskId.slice(0, 8)} · {statusLabel(task.status)}
                  </Badge>
                ))}
              </div>
            ) : tasks[0] ? (
              <Badge variant="outline" className="font-mono text-[10px]">
                {tasks[0].taskId.slice(0, 8)} · {statusLabel(tasks[0].status)}
              </Badge>
            ) : null}
          </div>

          {tasks.length > 0 ? (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
          ) : null}

          {error ? (
            <p className="mt-3 rounded-md border border-red-500/20 bg-red-950/30 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}

          {warnings.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-amber-700">
              {warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {showLogs ? (
        <div className="rounded-lg border border-border bg-card" id="generation-task-logs">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="flex items-center gap-2">
              <ScrollText className="size-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold text-foreground">任务日志</h3>
            </div>
            <Badge variant="secondary" className="text-[10px]">{logs.length} 条</Badge>
          </div>
          <AppLogList
            logs={logs}
            isLoading={isLoadingLogs}
            emptyText="日志加载中..."
            viewportClassName={compact ? 'max-h-36' : 'max-h-48'}
            logsEndRef={logsEndRef}
          />
        </div>
      ) : null}
    </div>
  );
}

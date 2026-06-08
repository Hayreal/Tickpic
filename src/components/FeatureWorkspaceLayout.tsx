import React from 'react';
import { Cpu, FolderOpen, PanelRightOpen, Sparkles, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface FeatureWorkspaceLayoutProps {
  submitId: string;
  onSubmit: () => void;
  isSubmitting: boolean;
  progressLabel: string;
  taskInProgress: boolean;
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
  onOpenDirectory?: () => void;
  showOpenDirectory?: boolean;
  parameters: React.ReactNode;
  drawer: React.ReactNode;
}

export default function FeatureWorkspaceLayout({
  submitId,
  onSubmit,
  isSubmitting,
  progressLabel,
  taskInProgress,
  drawerOpen,
  onDrawerOpenChange,
  onOpenDirectory,
  showOpenDirectory = false,
  parameters,
  drawer,
}: FeatureWorkspaceLayoutProps) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border bg-card px-5 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
          <Cpu className={cn('h-3.5 w-3.5 shrink-0', taskInProgress && 'animate-spin')} />
          <span className="truncate">{progressLabel || '填写参数后点击开始生成'}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onDrawerOpenChange(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-accent"
          >
            <PanelRightOpen className="h-3.5 w-3.5 text-muted-foreground" />
            任务信息
          </button>

          {showOpenDirectory && onOpenDirectory ? (
            <button
              type="button"
              onClick={onOpenDirectory}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-accent"
            >
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
              打开目录
            </button>
          ) : null}

          <button
            id={submitId}
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className={cn(
              'inline-flex cursor-pointer items-center gap-2 rounded-lg px-5 py-2 text-xs font-bold uppercase tracking-wide transition-all',
              isSubmitting
                ? 'bg-primary/80 text-primary-foreground cursor-wait'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]',
            )}
          >
            <Sparkles className={cn('h-4 w-4', isSubmitting && 'animate-spin')} />
            {isSubmitting ? '提交中...' : '开始生成'}
          </button>
        </div>
      </div>

      <section
        className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-5 py-5"
        id="feature-parameters-panel"
      >
        <div className="w-full">{parameters}</div>
      </section>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50" id="feature-task-drawer">
          <button
            type="button"
            aria-label="关闭任务信息"
            className="absolute inset-0 bg-black/30"
            onClick={() => onDrawerOpenChange(false)}
          />
          <aside
            className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-border bg-background shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">后台任务</p>
                <h2 className="text-lg font-semibold text-foreground">任务信息</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  进度、生成结果与日志；关闭抽屉不会中断任务。
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭任务信息"
                onClick={() => onDrawerOpenChange(false)}
                className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">{drawer}</div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

import React from 'react';
import { Clock, Copy, FolderOpen } from 'lucide-react';
import type { ResultItem } from '../shared/view/ui';
import { UI } from '../shared/view/design';
import { toDisplaySrc } from '../lib/fileUrl';
import { useOpenLocalImage } from '../hooks/useOpenLocalImage';
import ImagePreviewFallbackModal from './ImagePreviewFallbackModal';

interface GenerationResultProps {
  mode: 'single' | 'multi';
  state: 'empty' | 'running' | 'completed';
  results: ResultItem[];
  placeholders?: number;

  title?: string;
  count?: number;
  showCount?: boolean;
  progressLabel?: string;
  showOpenDirectory?: boolean;
  headerRight?: React.ReactNode;

  emptyDescription?: string;

  onOpenDirectory?: (item: ResultItem) => void;
  onOpenDirectoryAll?: () => void;
  onCopyImage?: (item: ResultItem) => void;
  compact?: boolean;
}

function AsyncResultState({
  state,
  description,
}: {
  state: 'empty' | 'running' | 'completed';
  description?: string;
}) {
  const title = state === 'running' ? '任务已进入后台队列' : '等待提交任务';
  const copy = state === 'running'
    ? '生成通常需要较长时间。任务会持续更新进度，完成后结果会自动出现在这里。'
    : description ?? '提交任务后，这里会显示后台生成进度；结果完成后再展示图片。';

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Clock className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">{copy}</p>
        </div>
      </div>
    </div>
  );
}

export default function GenerationResult({
  mode,
  state,
  results,
  placeholders = 0,
  title = '生成结果',
  count,
  showCount = false,
  progressLabel,
  showOpenDirectory = false,
  headerRight,
  emptyDescription,
  onOpenDirectory,
  onOpenDirectoryAll,
  onCopyImage,
  compact = false,
}: GenerationResultProps) {
  const { openPreview, fallbackPreview, closeFallbackPreview } = useOpenLocalImage();
  const hasResults = results.length > 0;
  const showProgress = showCount && (state === 'running' || state === 'completed') && progressLabel;
  const expectedSlots = Math.max(placeholders, count ?? 0);
  const slotCount = expectedSlots > 0 ? expectedSlots : results.length;
  const visibleResults = expectedSlots > 0 ? results.slice(0, expectedSlots) : results;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {!compact ? (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-foreground">
              {title}
              {count !== undefined && ` (${count})`}
            </h3>
            {showProgress && (
              <p className="text-[11px] text-muted-foreground font-sans">
                {progressLabel}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(showOpenDirectory || onOpenDirectoryAll) && hasResults && onOpenDirectoryAll && (
              <button
                type="button"
                onClick={onOpenDirectoryAll}
                className={`${UI.btnSecondary} py-1.5 px-3 text-[11px]`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                打开目录
              </button>
            )}
            {headerRight}
          </div>
        </div>
      ) : showProgress ? (
        <p className="mb-2 text-[11px] text-muted-foreground">{progressLabel}</p>
      ) : null}

      {state === 'empty' ? (
        <AsyncResultState state={state} description={emptyDescription} />
      ) : mode === 'multi' ? (
        visibleResults.length === 0 ? (
          <AsyncResultState state={state} description={emptyDescription} />
        ) : (
        <div className={slotCount <= 1 ? 'flex justify-start' : 'grid grid-cols-[repeat(auto-fit,minmax(180px,240px))] gap-4'}>
          {Array.from({ length: Math.max(slotCount, 1) }).map((_, index) => {
            const item = visibleResults[index];
            if (!item) {
              return (
                <div
                  key={`placeholder-${index}`}
                  className={slotCount <= 1 ? 'w-full max-w-60 aspect-square bg-surface-container-low border border-border rounded-lg flex flex-col items-center justify-center gap-2.5 text-muted-foreground font-medium' : 'aspect-square bg-surface-container-low border border-border rounded-lg flex flex-col items-center justify-center gap-2.5 text-muted-foreground font-medium'}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-border">
                    <Clock className="w-4 h-4 text-slate-700" />
                  </div>
                  <span className="text-xs text-muted-foreground tracking-wide">等待生成</span>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                className={slotCount <= 1 ? 'w-full max-w-80 aspect-square bg-white border border-border hover:border-slate-300 rounded-lg overflow-hidden flex items-center justify-center relative p-3 group shadow-sm' : 'aspect-square bg-white border border-border hover:border-slate-300 rounded-lg overflow-hidden flex items-center justify-center relative p-3 group'}
              >
                <button
                  type="button"
                  className="flex h-full w-full items-center justify-center cursor-zoom-in"
                  title="预览图片"
                  onClick={() => void openPreview(item.imageUrl, item.taskId ?? item.id)}
                >
                  <img
                    src={toDisplaySrc(item.imageUrl)}
                    className="max-w-full max-h-full object-contain rounded pointer-events-none"
                    alt="Generated result"
                  />
                </button>
                {item.badge && (
                  <div className="absolute top-2 right-2">
                    <span className="ui-badge-success px-2 py-0.5">
                      {item.badge}
                    </span>
                  </div>
                )}
                <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 p-1.5 rounded border border-border">
                  {onCopyImage && (
                    <button
                      type="button"
                      onClick={() => onCopyImage(item)}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                      title="复制图片"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenDirectory?.(item)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                    title="打开目录"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        )
      ) : (
        visibleResults.length > 0 ? (
          <div className="flex justify-start">
            <div
              className="w-full max-w-96 aspect-square rounded-lg bg-white border border-border overflow-hidden relative group shadow-sm"
            >
              <button
                type="button"
                className="flex h-full w-full items-center justify-center cursor-zoom-in"
                title="预览图片"
                onClick={() => void openPreview(
                  visibleResults[0].imageUrl,
                  visibleResults[0].taskId ?? visibleResults[0].id,
                )}
              >
                <img
                  src={toDisplaySrc(visibleResults[0].imageUrl)}
                  className="w-full h-full object-contain p-4 pointer-events-none"
                  alt="Generated result"
                />
              </button>
              {visibleResults[0].badge && (
                <div className="absolute top-2 right-2">
                  <span className="ui-badge-success px-2.5 py-1">
                    {visibleResults[0].badge}
                  </span>
                </div>
              )}
              <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 p-2.5 rounded border border-border">
                {visibleResults[0].taskId && (
                  <span className="text-[10px] text-muted-foreground font-mono">{visibleResults[0].taskId}</span>
                )}
                <div className="flex items-center gap-2">
                  {onCopyImage && (
                    <button
                      type="button"
                      onClick={() => onCopyImage(visibleResults[0])}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                      title="复制图片"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenDirectory?.(visibleResults[0])}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                    title="打开目录"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <AsyncResultState state={state} description={emptyDescription} />
        )
      )}
      {fallbackPreview ? (
        <ImagePreviewFallbackModal
          filePath={fallbackPreview.filePath}
          fileName={fallbackPreview.fileName}
          onClose={closeFallbackPreview}
        />
      ) : null}
    </div>
  );
}

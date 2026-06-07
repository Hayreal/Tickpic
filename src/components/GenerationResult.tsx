import React from 'react';
import { Clock, FolderOpen } from 'lucide-react';
import type { ResultItem } from '../shared/view/ui';
import { UI } from '../shared/view/design';
import { toDisplaySrc } from '../lib/fileUrl';

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
}: GenerationResultProps) {
  const hasResults = results.length > 0;
  const showProgress = showCount && (state === 'running' || state === 'completed') && progressLabel;

  return (
    <div className="flex-1 flex flex-col">
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

      {state === 'empty' ? (
        <div className="flex-1 flex items-center justify-center min-h-[300px] bg-white rounded-lg border border-border p-6">
          {emptyDescription && (
            <p className="text-[11px] text-muted-foreground max-w-md text-center leading-relaxed font-sans">
              {emptyDescription}
            </p>
          )}
        </div>
      ) : mode === 'multi' ? (
        <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
          {Array.from({ length: Math.max(results.length, placeholders) }).map((_, index) => {
            const item = results[index];
            if (!item) {
              return (
                <div
                  key={`placeholder-${index}`}
                  className="aspect-square bg-surface-container-low border border-border rounded-lg flex flex-col items-center justify-center gap-2.5 text-muted-foreground font-medium"
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
                className="aspect-square bg-white border border-border hover:border-slate-300 rounded-lg overflow-hidden flex items-center justify-center relative p-3 group"
              >
                <img
                  src={toDisplaySrc(item.imageUrl)}
                  className="max-w-full max-h-full object-contain rounded"
                  alt="Generated result"
                />
                {item.badge && (
                  <div className="absolute top-2 right-2">
                    <span className="ui-badge-success px-2 py-0.5">
                      {item.badge}
                    </span>
                  </div>
                )}
                <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 p-1.5 rounded border border-border">
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
      ) : (
        results.length > 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-lg aspect-video rounded-lg bg-white border border-border overflow-hidden relative group">
              <img
                src={toDisplaySrc(results[0].imageUrl)}
                className="w-full h-full object-cover"
                alt="Generated result"
              />
              {results[0].badge && (
                <div className="absolute top-2 right-2">
                  <span className="ui-badge-success px-2.5 py-1">
                    {results[0].badge}
                  </span>
                </div>
              )}
              <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 p-2.5 rounded border border-border">
                {results[0].taskId && (
                  <span className="text-[10px] text-muted-foreground font-mono">{results[0].taskId}</span>
                )}
                <button
                  type="button"
                  onClick={() => onOpenDirectory?.(results[0])}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                  title="打开目录"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

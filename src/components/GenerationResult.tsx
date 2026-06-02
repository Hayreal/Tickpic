import React from 'react';
import { Download } from 'lucide-react';
import type { ResultItem } from '../shared/view/ui';

interface GenerationResultProps {
  mode: 'single' | 'multi';
  state: 'empty' | 'completed';
  results: ResultItem[];

  title?: string;
  count?: number;
  showCount?: boolean;
  showDownloadAll?: boolean;
  headerRight?: React.ReactNode;

  emptyDescription?: string;

  onDownload?: (item: ResultItem) => void;
  onDownloadAll?: () => void;
}

export default function GenerationResult({
  mode,
  state,
  results,
  title = '生成结果',
  count,
  showCount = false,
  showDownloadAll = false,
  headerRight,
  emptyDescription,
  onDownload,
  onDownloadAll,
}: GenerationResultProps) {
  const hasResults = state === 'completed' && results.length > 0;

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">
            {title}
            {count !== undefined && ` (${count})`}
          </h3>
          {showCount && hasResults && (
            <p className="text-[11px] text-slate-500 font-sans">
              {results.length} / {results.length} completed
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showDownloadAll && hasResults && (
            <button
              onClick={onDownloadAll}
              className="cursor-pointer text-[11px] bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-white font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-violet-400" />
              Download All
            </button>
          )}
          {headerRight}
        </div>
      </div>

      {/* Content */}
      {state === 'empty' ? (
        <div className="flex-1 flex items-center justify-center min-h-[300px] bg-slate-950/10 rounded-xl border border-slate-900/40 p-6">
          {emptyDescription && (
            <p className="text-[11px] text-slate-500 max-w-md text-center leading-relaxed font-sans">
              {emptyDescription}
            </p>
          )}
        </div>
      ) : mode === 'multi' ? (
        <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
          {results.map((item) => (
            <div
              key={item.id}
              className="aspect-square bg-[#100f13] border border-slate-900 hover:border-slate-800 rounded-xl overflow-hidden shadow-inner flex items-center justify-center relative p-3 group"
            >
              <img
                src={item.imageUrl}
                className="max-w-full max-h-full object-contain rounded-lg"
                alt="Generated result"
              />
              {item.badge && (
                <div className="absolute top-2 right-2">
                  <span className="px-2 py-0.5 text-[10px] uppercase font-mono tracking-wide font-bold bg-[#10b981]/15 text-[#10b981] rounded-full border border-[#10b981]/25">
                    {item.badge}
                  </span>
                </div>
              )}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/80 p-1.5 rounded-lg border border-slate-800">
                <button
                  onClick={() => onDownload?.(item)}
                  className="text-white hover:text-violet-400 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        results.length > 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-lg aspect-video rounded-xl bg-slate-950 border border-slate-900 overflow-hidden relative group animate-fadeIn">
              <img
                src={results[0].imageUrl}
                className="w-full h-full object-cover"
                alt="Generated result"
              />
              {results[0].badge && (
                <div className="absolute top-2 right-2">
                  <span className="px-2.5 py-1 text-[10px] uppercase font-mono tracking-wide font-bold bg-[#10b981]/15 text-[#10b981] rounded-full border border-[#10b981]/25">
                    {results[0].badge}
                  </span>
                </div>
              )}
              <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 p-2.5 rounded-lg border border-slate-800">
                {results[0].taskId && (
                  <span className="text-[10px] text-slate-300 font-mono">{results[0].taskId}</span>
                )}
                <button
                  onClick={() => onDownload?.(results[0])}
                  className="text-white hover:text-violet-400 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

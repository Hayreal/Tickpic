import React, { useRef, useCallback } from 'react';
import { Upload, X, Layers } from 'lucide-react';
import { ImportBatch, StoredImageRecord } from '../types';
import { collectImportFiles } from '../lib/importBatch';

interface ImageUploaderProps {
  batch: ImportBatch | null;
  onBatchChange: (batch: ImportBatch | null) => void;
  page: 'sticker' | 'product';
  feature: string;
  label?: string;
  labelIcon?: React.ReactNode;
  placeholder?: string;
  description?: string;
  optional?: boolean;
}

export default function ImageUploader({
  batch,
  onBatchChange,
  page,
  feature,
  label,
  labelIcon,
  placeholder = '点击、拖拽或粘贴图片上传',
  description = '最多 4 张 · PNG, JPG, WEBP',
  optional = false,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildBatch = useCallback(
    (files: File[]): ImportBatch => ({
      batchId: `batch-${Date.now()}`,
      page,
      feature,
      images: files.map((file, i) => ({
        id: `img-${Date.now()}-${i}`,
        fileName: file.name,
        filePath: URL.createObjectURL(file),
        fileSize: file.size,
        mimeType: file.type,
        createdAt: new Date().toISOString(),
      })),
      createdAt: new Date().toISOString(),
    }),
    [page, feature],
  );

  const processFiles = useCallback(
    (rawFiles: File[]) => {
      const result = collectImportFiles(rawFiles);
      if (result.hasOverflow) {
        console.warn(`最多导入 4 张图片，已忽略 ${result.rejectedCount} 张`);
      }
      if (result.accepted.length > 0) {
        onBatchChange(buildBatch(result.accepted));
      }
    },
    [buildBatch, onBatchChange],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) processFiles(files);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items) as DataTransferItem[];
    const files = items
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (files.length > 0) {
      e.preventDefault();
      processFiles(files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) processFiles(files);
    e.target.value = '';
  };

  const removeImage = (imageId: string) => {
    if (!batch) return;
    const remaining = batch.images.filter((img) => img.id !== imageId);
    onBatchChange(remaining.length === 0 ? null : { ...batch, images: remaining });
  };

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
            {labelIcon ?? <Layers className="w-3.5 h-3.5 text-violet-400" />}
            {label}
          </label>
          {optional && (
            <span className="text-[10px] font-mono text-violet-400 bg-violet-400/10 px-1 py-0.5 rounded">
              可选
            </span>
          )}
        </div>
      )}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPaste={handlePaste}
        onClick={() => fileInputRef.current?.click()}
        tabIndex={0}
        className="h-32 rounded-xl border border-dashed border-slate-800 hover:border-[#7c3aed]/50 bg-slate-950/40 hover:bg-slate-950/80 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group overflow-hidden relative focus:outline-none focus:border-[#7c3aed]/50"
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          multiple
          onChange={handleFileChange}
        />
        {batch ? (
          <div
            className="flex flex-col gap-2 w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-2 gap-2">
              {batch.images.map((img) => (
                <div
                  key={img.id}
                  className="relative group aspect-square bg-slate-950 rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center"
                >
                  <img
                    src={img.filePath}
                    className="w-full h-full object-contain p-1"
                    alt={img.fileName}
                  />
                  <button
                    className="absolute top-1 right-1 bg-slate-900/80 hover:bg-red-900/80 text-white p-0.5 rounded border border-slate-800 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(img.id);
                    }}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-slate-950/80 px-1 py-0.5">
                    <span className="text-[9px] text-slate-500 truncate block">
                      {img.fileName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-slate-500">
                {batch.images.length} 张图片已导入
              </span>
              <button
                className="text-[10px] text-slate-500 hover:text-red-400 cursor-pointer transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onBatchChange(null);
                }}
              >
                清除全部
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center group-hover:scale-105 transition-transform border border-slate-800">
              <Upload className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-center">
              <p className="text-xs text-white font-semibold">{placeholder}</p>
              <p className="text-[10px] text-slate-500 mt-1">{description}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

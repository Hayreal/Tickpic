import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Upload, X, Layers } from 'lucide-react';
import type { ImportBatch } from '../shared/domain/images';
import { collectImportFiles, extractClipboardImageFiles } from '../lib/importBatch';
import { useDesktopClient } from '../hooks/useDesktopClient';
import { UI } from '../shared/view/design';
import { Label } from '@/src/components/ui/label';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';
import { toDisplaySrc } from '../lib/fileUrl';
import { useOpenLocalImage } from '../hooks/useOpenLocalImage';
import ImagePreviewFallbackModal from './ImagePreviewFallbackModal';
import { REFERENCE_FIELD_SPAN } from './FeatureParameterPanels';

interface ImageUploaderProps {
  batch: ImportBatch | null;
  onBatchChange: (batch: ImportBatch | null) => void;
  page: ImportBatch['page'];
  feature: string;
  label?: string;
  labelIcon?: React.ReactNode;
  placeholder?: string;
  description?: string;
  optional?: boolean;
  /** 上传虚线区使用 1:1 正方形容器 */
  square?: boolean;
}

export default function ImageUploader({
  batch,
  onBatchChange,
  page,
  feature,
  label,
  labelIcon,
  placeholder = '点击、拖拽或粘贴图片上传',
  description = '可批量上传 · PNG, JPG, WEBP',
  optional = false,
  square = false,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadZoneRef = useRef<HTMLDivElement>(null);
  const isHoveringUploadZoneRef = useRef(false);
  const desktopClient = useDesktopClient();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { openPreview, fallbackPreview, closeFallbackPreview } = useOpenLocalImage();

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

  const mergeBatches = useCallback((existing: ImportBatch | null, incoming: ImportBatch): ImportBatch => {
    if (!existing) return incoming;
    return {
      ...incoming,
      batchId: existing.batchId,
      images: [...existing.images, ...incoming.images],
      createdAt: existing.createdAt,
    };
  }, []);

  const processFiles = useCallback(
    async (rawFiles: File[]) => {
      const result = collectImportFiles(rawFiles);
      const accepted = result.accepted;
      if (accepted.length === 0) return;

      if (!desktopClient) {
        onBatchChange(mergeBatches(batch, buildBatch(accepted)));
        return;
      }

      setIsSaving(true);
      setSaveError(null);

      try {
        const serializedFiles = await Promise.all(
          accepted.map(async (file) => ({
            name: file.name,
            type: file.type,
            buffer: await file.arrayBuffer(),
          })),
        );
        const saved = await desktopClient.saveImportBatch({ page, feature, files: serializedFiles });
        onBatchChange(mergeBatches(batch, saved));
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save images');
        onBatchChange(mergeBatches(batch, buildBatch(accepted)));
      } finally {
        setIsSaving(false);
      }
    },
    [batch, buildBatch, mergeBatches, onBatchChange, desktopClient, page, feature],
  );

  const handlePaste = useCallback((event: ClipboardEvent | React.ClipboardEvent<HTMLDivElement>) => {
    const files = extractClipboardImageFiles(event.clipboardData);
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    void processFiles(files);
  }, [processFiles]);

  useEffect(() => {
    const handleWindowPaste = (event: ClipboardEvent) => {
      const uploadZone = uploadZoneRef.current;
      if (!uploadZone) {
        return;
      }

      const isFocused = document.activeElement === uploadZone;
      if (!isHoveringUploadZoneRef.current && !isFocused) {
        return;
      }

      handlePaste(event);
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [handlePaste]);

  const hasImages = (batch?.images.length ?? 0) > 0;

  return (
    <div className={cn(REFERENCE_FIELD_SPAN, 'space-y-2')}>
      {label && (
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            {labelIcon ?? <Layers className="w-3.5 h-3.5" />}
            {label}
          </Label>
          {optional && <Badge variant="secondary">可选</Badge>}
        </div>
      )}

      <div className={UI.uploadTileGrid}>
        {batch?.images.map((img) => (
          <div key={img.id} className="relative group aspect-square rounded-lg border bg-card overflow-hidden shadow-sm">
            <button
              type="button"
              className="w-full h-full flex items-center justify-center cursor-zoom-in"
              title="预览图片"
              onClick={() => void openPreview(img.filePath, img.fileName)}
            >
              <img src={toDisplaySrc(img.filePath)} className="w-full h-full object-contain p-1.5 pointer-events-none" alt={img.fileName} />
            </button>
            <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  const remaining = batch.images.filter((i) => i.id !== img.id);
                  onBatchChange(remaining.length === 0 ? null : { ...batch, images: remaining });
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="absolute bottom-0 inset-x-0 bg-card/95 border-t px-2 py-1">
              <span className="text-[9px] text-muted-foreground truncate block font-mono">{img.fileName}</span>
            </div>
          </div>
        ))}

        <div
          ref={uploadZoneRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) processFiles(files);
          }}
          onMouseEnter={() => {
            isHoveringUploadZoneRef.current = true;
            uploadZoneRef.current?.focus({ preventScroll: true });
          }}
          onMouseLeave={() => {
            isHoveringUploadZoneRef.current = false;
          }}
          onFocus={() => {
            isHoveringUploadZoneRef.current = true;
          }}
          onBlur={() => {
            isHoveringUploadZoneRef.current = false;
          }}
          onClick={() => fileInputRef.current?.click()}
          tabIndex={0}
          role="button"
          aria-label={placeholder}
          className={cn(
            UI.uploadZone,
            '!h-auto aspect-square min-h-0 group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            hasImages ? 'p-2 gap-1' : 'p-3 gap-1.5',
          )}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) processFiles(files);
              e.target.value = '';
            }}
          />
          <div
            className={cn(
              'flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:scale-105 transition-transform',
              hasImages ? 'h-8 w-8' : 'h-10 w-10',
            )}
          >
            <Upload className={hasImages ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </div>
          <div className="min-w-0 text-center px-1">
            <p className={cn('font-medium text-foreground leading-snug', hasImages ? 'text-[10px]' : 'text-xs')}>
              {hasImages ? '添加图片' : placeholder}
            </p>
            {!hasImages ? (
              <p className="text-muted-foreground mt-0.5 text-[10px] leading-snug">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {hasImages ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{batch!.images.length} 张</span>
          <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => onBatchChange(null)}>
            清除全部
          </button>
        </div>
      ) : null}

      {isSaving && <p className="text-xs text-primary animate-pulse">正在保存图片...</p>}
      {saveError && <p className="text-xs text-destructive">保存失败: {saveError}</p>}

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

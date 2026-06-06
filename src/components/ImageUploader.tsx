import React, { useRef, useCallback, useState } from 'react';
import { Upload, X, Layers, ZoomIn } from 'lucide-react';
import type { ImportBatch, StoredImageRecord } from '../shared/domain/images';
import { collectImportFiles } from '../lib/importBatch';
import { useDesktopClient } from '../hooks/useDesktopClient';
import { UI } from '../shared/view/design';
import { Label } from '@/src/components/ui/label';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';

const MAX_IMPORT_IMAGES = 4;

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

function toDisplaySrc(filePath: string) {
  if (filePath.startsWith('blob:') || filePath.startsWith('file:') || filePath.startsWith('http')) {
    return filePath;
  }
  return `file://${filePath}`;
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
  const desktopClient = useDesktopClient();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<StoredImageRecord | null>(null);

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
      images: [...existing.images, ...incoming.images].slice(0, MAX_IMPORT_IMAGES),
      createdAt: existing.createdAt,
    };
  }, []);

  const processFiles = useCallback(
    async (rawFiles: File[]) => {
      const existingCount = batch?.images.length ?? 0;
      const slotsLeft = MAX_IMPORT_IMAGES - existingCount;
      if (slotsLeft <= 0) return;

      const result = collectImportFiles(rawFiles);
      const accepted = result.accepted.slice(0, slotsLeft);
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

  const imageCount = batch?.images.length ?? 0;
  const canAddMore = imageCount < MAX_IMPORT_IMAGES;

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            {labelIcon ?? <Layers className="w-3.5 h-3.5" />}
            {label}
          </Label>
          {optional && <Badge variant="secondary">可选</Badge>}
        </div>
      )}

      {canAddMore && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) processFiles(files);
          }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.items as DataTransferItemList)
              .filter((item: DataTransferItem) => item.type.startsWith('image/'))
              .map((item: DataTransferItem) => item.getAsFile())
              .filter((f): f is File => f !== null);
            if (files.length > 0) {
              e.preventDefault();
              processFiles(files);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          tabIndex={0}
          className={cn(UI.uploadZone, 'group')}
        >
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) processFiles(files);
            e.target.value = '';
          }} />
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:scale-105 transition-transform">
            <Upload className="h-4 w-4" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">{placeholder}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
      )}

      {batch && batch.images.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {batch.images.map((img) => (
              <div key={img.id} className="relative group aspect-square rounded-lg border bg-card overflow-hidden shadow-sm">
                <button type="button" className="w-full h-full flex items-center justify-center" onClick={() => setPreviewImage(img)}>
                  <img src={toDisplaySrc(img.filePath)} className="w-full h-full object-contain p-1.5" alt={img.fileName} />
                </button>
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button type="button" variant="secondary" size="icon" className="h-6 w-6" onClick={() => setPreviewImage(img)}>
                    <ZoomIn className="h-3 w-3" />
                  </Button>
                  <Button type="button" variant="destructive" size="icon" className="h-6 w-6" onClick={() => {
                    const remaining = batch.images.filter((i) => i.id !== img.id);
                    onBatchChange(remaining.length === 0 ? null : { ...batch, images: remaining });
                  }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-card/95 border-t px-2 py-1">
                  <span className="text-[9px] text-muted-foreground truncate block font-mono">{img.fileName}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{batch.images.length} / {MAX_IMPORT_IMAGES} 张</span>
            <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => onBatchChange(null)}>
              清除全部
            </button>
          </div>
        </div>
      )}

      {isSaving && <p className="text-xs text-primary animate-pulse">正在保存图片...</p>}
      {saveError && <p className="text-xs text-destructive">保存失败: {saveError}</p>}

      {previewImage && (
        <div className={UI.modalOverlay} onClick={() => setPreviewImage(null)}>
          <div className={UI.modal} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-mono truncate">{previewImage.fileName}</span>
              <Button variant="ghost" size="icon" onClick={() => setPreviewImage(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 flex items-center justify-center bg-muted/30 min-h-[240px]">
              <img src={toDisplaySrc(previewImage.filePath)} alt={previewImage.fileName} className="max-h-[65vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

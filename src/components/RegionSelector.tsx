import React, { useCallback, useRef, useState } from 'react';
import { X, ZoomIn } from 'lucide-react';
import type { ImageRole, RegionInput } from '../shared/domain/imageFeatureApi';
import { UI } from '../shared/view/design';
import { toDisplaySrc } from '../lib/fileUrl';
import { useOpenLocalImage } from '../hooks/useOpenLocalImage';
import ImagePreviewFallbackModal from './ImagePreviewFallbackModal';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';

interface RegionSelectorProps {
  imagePath: string;
  imageRole: ImageRole;
  region: RegionInput | null;
  onRegionChange: (region: RegionInput | null) => void;
  operationHint?: string;
  label?: string;
  caption?: string;
  compact?: boolean;
  /** 与上传组件一致的 1:1 横向瓦片布局 */
  tile?: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function RegionSelector({
  imagePath,
  imageRole,
  region,
  onRegionChange,
  operationHint = 'selected area',
  label = '框选区域 (可选)',
  caption,
  compact = false,
  tile = false,
}: RegionSelectorProps) {
  const { openPreview, fallbackPreview, closeFallbackPreview } = useOpenLocalImage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [draftRect, setDraftRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const getImageLayout = useCallback(() => {
    const container = containerRef.current;
    if (!container || naturalSize.width === 0 || naturalSize.height === 0) {
      return null;
    }

    const rect = container.getBoundingClientRect();
    const scale = Math.min(rect.width / naturalSize.width, rect.height / naturalSize.height);
    const width = naturalSize.width * scale;
    const height = naturalSize.height * scale;
    const offsetX = (rect.width - width) / 2;
    const offsetY = (rect.height - height) / 2;

    return { rect, scale, offsetX, offsetY, width, height };
  }, [naturalSize]);

  const clientToNatural = useCallback((clientX: number, clientY: number) => {
    const layout = getImageLayout();
    if (!layout) return null;

    const localX = clientX - layout.rect.left - layout.offsetX;
    const localY = clientY - layout.rect.top - layout.offsetY;
    if (localX < 0 || localY < 0 || localX > layout.width || localY > layout.height) {
      return null;
    }

    return {
      x: clamp(Math.round(localX / layout.scale), 0, naturalSize.width - 1),
      y: clamp(Math.round(localY / layout.scale), 0, naturalSize.height - 1),
    };
  }, [getImageLayout, naturalSize.height, naturalSize.width]);

  const naturalToDisplayRect = useCallback((input: { x: number; y: number; width: number; height: number }) => {
    const layout = getImageLayout();
    if (!layout) return null;

    return {
      left: layout.offsetX + input.x * layout.scale,
      top: layout.offsetY + input.y * layout.scale,
      width: input.width * layout.scale,
      height: input.height * layout.scale,
    };
  }, [getImageLayout]);

  const finishDrag = useCallback((clientX: number, clientY: number) => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    setDraftRect(null);

    if (!start) return;

    const end = clientToNatural(clientX, clientY);
    if (!end) {
      return;
    }

    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    if (width < 4 || height < 4) {
      return;
    }

    onRegionChange({
      id: region?.id ?? `${imageRole}-${imagePath}`,
      imageRole,
      x,
      y,
      width,
      height,
      operationHint,
    });
  }, [clientToNatural, imagePath, imageRole, onRegionChange, operationHint, region?.id]);

  const activeRect = draftRect ?? (region ? { x: region.x, y: region.y, width: region.width, height: region.height } : null);
  const displayRect = activeRect ? naturalToDisplayRect(activeRect) : null;

  return (
    <div className={cn(tile ? '' : 'space-y-2')}>
      {!tile ? (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <label className={UI.label}>{label}</label>
            {caption ? (
              <p className="truncate text-[10px] text-muted-foreground">{caption}</p>
            ) : null}
          </div>
          {region ? (
            <button
              type="button"
              className="shrink-0 text-[10px] text-muted-foreground hover:text-error cursor-pointer transition-colors"
              onClick={() => onRegionChange(null)}
            >
              清除框选
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        ref={containerRef}
        className={cn(
          'group/region relative rounded-lg border border-border bg-white overflow-hidden cursor-crosshair select-none shadow-sm',
          tile ? 'aspect-square w-full' : compact ? 'h-40' : 'h-48',
          tile && region && 'border-primary/50',
        )}
        onMouseDown={(event) => {
          const point = clientToNatural(event.clientX, event.clientY);
          if (!point) return;
          dragStartRef.current = point;
          setDraftRect({ x: point.x, y: point.y, width: 0, height: 0 });
        }}
        onMouseMove={(event) => {
          const start = dragStartRef.current;
          if (!start) return;
          const current = clientToNatural(event.clientX, event.clientY);
          if (!current) return;

          setDraftRect({
            x: Math.min(start.x, current.x),
            y: Math.min(start.y, current.y),
            width: Math.abs(current.x - start.x),
            height: Math.abs(current.y - start.y),
          });
        }}
        onMouseUp={(event) => finishDrag(event.clientX, event.clientY)}
        onMouseLeave={(event) => {
          if (dragStartRef.current) {
            finishDrag(event.clientX, event.clientY);
          }
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          void openPreview(imagePath, caption ?? 'image');
        }}
      >
        <img
          src={toDisplaySrc(imagePath)}
          alt="Region source"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          onLoad={(event) => {
            setNaturalSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            });
          }}
        />
        {displayRect && (
          <div
            className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
            style={{
              left: displayRect.left,
              top: displayRect.top,
              width: displayRect.width,
              height: displayRect.height,
            }}
          />
        )}
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover/region:opacity-100 transition-opacity">
          {tile && region ? (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="h-6 w-6"
              title="清除框选"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onRegionChange(null);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-6 w-6"
            title="预览图片"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              void openPreview(imagePath, caption ?? 'image');
            }}
          >
            <ZoomIn className="h-3 w-3" />
          </Button>
        </div>
        {tile && caption ? (
          <div className="absolute bottom-0 inset-x-0 bg-card/95 border-t px-2 py-1 pointer-events-none">
            <span className="text-[9px] text-muted-foreground truncate block font-mono">{caption}</span>
          </div>
        ) : null}
      </div>
      {!tile && !compact ? (
        <p className="text-[10px] text-muted-foreground">在图片上拖拽框选目标区域，坐标将按原图像素提交；双击或点击右上角可系统预览。</p>
      ) : null}
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

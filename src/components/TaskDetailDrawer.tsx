import { useCallback, useEffect } from 'react';
import { X, FolderOpen, RotateCcw, Copy } from 'lucide-react';
import type { ImageRole, ImageTaskRequest, RegionInput } from '../shared/domain/imageFeatureApi';
import type { TaskRecord } from '../shared/domain/tasks';
import type { StoredImageRecord } from '../shared/domain/images';
import { aggregateTaskStatuses } from '../features/tasks/taskBatchGrouping';
import { toTaskItem } from '../features/tasks/taskMappers';
import { toDisplaySrc } from '../lib/fileUrl';
import { useOpenLocalImage } from '../hooks/useOpenLocalImage';
import ImagePreviewFallbackModal from './ImagePreviewFallbackModal';
import { useDesktopClient } from '../hooks/useDesktopClient';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Separator } from '@/src/components/ui/separator';
import { cn } from '@/src/lib/utils';

interface TaskDetailDrawerProps {
  task: TaskRecord | null;
  relatedTasks?: TaskRecord[];
  onClose: () => void;
  onOpenDirectory?: (task: TaskRecord) => void;
  onRestoreTask?: (task: TaskRecord) => void;
  canRestoreTask?: boolean;
  isOpeningDirectory?: boolean;
}

const IMAGE_ROLE_LABELS: Record<ImageRole, string> = {
  source: '源图',
  reference: '参考图',
  style: '风格图',
  product: '产品图',
  logo: 'Logo 图',
};

const PRODUCT_SET_CONTROL_LABELS = {
  productHandheldMode: { auto: 'AI 自动判断', handheld: '手持展示', not_handheld: '不手持' },
  productEffectMode: { auto: 'AI 自动判断', show: '展示具体效果', hide: '不展示具体效果' },
  comparisonLayout: { auto: 'AI 自动', horizontal: '左右对比', vertical: '上下对比' },
  comparisonIntensity: { light: '轻度', medium: '中度', heavy: '重度' },
  multiSceneLayout: { single: '单场景', collage: '拼图', grid: '宫格' },
} as const;

function ParamRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const displayValue = typeof value === 'boolean' ? (value ? '是' : '否') : String(value);

  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words whitespace-pre-wrap">{displayValue}</dd>
    </div>
  );
}

function formatRegions(regions: RegionInput[]) {
  return regions
    .map((region) => {
      const role = region.imageRole ? IMAGE_ROLE_LABELS[region.imageRole] : '未指定';
      const label = region.label ? ` · ${region.label}` : '';
      return `${region.id} (${role}${label}) · x=${region.x}, y=${region.y}, w=${region.width}, h=${region.height}`;
    })
    .join('\n');
}

function buildRequestParams(request: ImageTaskRequest) {
  const modelOverrides = request.modelOverrides;
  const modelSummary = modelOverrides
    ? [
        modelOverrides.protocol ? `协议: ${modelOverrides.protocol}` : null,
        modelOverrides.vision ? `理解: ${modelOverrides.vision}` : null,
        modelOverrides.generation ? `生成: ${modelOverrides.generation}` : null,
        modelOverrides.edit ? `编辑: ${modelOverrides.edit}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <dl>
      <ParamRow label="提示词" value={request.prompt} />
      <ParamRow label="反向提示词" value={request.negativePrompt} />
      <ParamRow label="具体场景词" value={request.scenePrompt} />
      <ParamRow
        label="手持方式"
        value={request.productHandheldMode && PRODUCT_SET_CONTROL_LABELS.productHandheldMode[request.productHandheldMode]}
      />
      <ParamRow
        label="具体效果"
        value={request.productEffectMode && PRODUCT_SET_CONTROL_LABELS.productEffectMode[request.productEffectMode]}
      />
      <ParamRow
        label="对比布局"
        value={request.comparisonLayout && PRODUCT_SET_CONTROL_LABELS.comparisonLayout[request.comparisonLayout]}
      />
      <ParamRow
        label="对比效果程度"
        value={request.comparisonIntensity && PRODUCT_SET_CONTROL_LABELS.comparisonIntensity[request.comparisonIntensity]}
      />
      <ParamRow
        label="画面模式"
        value={request.multiSceneLayout && PRODUCT_SET_CONTROL_LABELS.multiSceneLayout[request.multiSceneLayout]}
      />
      <ParamRow label="出图数量" value={request.count} />
      <ParamRow label="品牌" value={request.brand} />
      <ParamRow label="产品名称" value={request.productName} />
      <ParamRow label="产品品类" value={request.productCategory} />
      <ParamRow label="素材" value={request.material} />
      <ParamRow
        label="卖点"
        value={request.sellingPoints?.length ? request.sellingPoints.join('、') : undefined}
      />
      <ParamRow label="容量/规格" value={request.capacity} />
      <ParamRow label="Logo 文字" value={request.logoText} />
      <ParamRow label="风格" value={request.style} />
      <ParamRow label="色块排版" value={request.colorBlockLayout} />
      <ParamRow label="配色方案" value={request.colorScheme} />
      <ParamRow label="宽高比" value={request.aspectRatio} />
      <ParamRow
        label={request.feature === 'product_comparison_image' ? 'After 产品展示' : '展示产品'}
        value={request.showProduct === undefined ? undefined : request.showProduct}
      />
      <ParamRow label="模型覆盖" value={modelSummary} />
      <ParamRow
        label="框选区域"
        value={request.regions?.length ? formatRegions(request.regions) : undefined}
      />
    </dl>
  );
}

function ImageGrid({
  title,
  images,
  emptyText,
  onCopyImage,
}: {
  title: string;
  images: StoredImageRecord[];
  emptyText: string;
  onCopyImage?: (filePath: string) => void;
}) {
  const { openPreview, fallbackPreview, closeFallbackPreview } = useOpenLocalImage();

  return (
    <section>
      <h3 className="text-sm font-medium mb-3">{title}</h3>
      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {images.map((image) => (
            <figure
              key={image.id}
              className="rounded-lg border bg-white overflow-hidden group"
            >
              <div
                className="aspect-square relative flex w-full items-center justify-center p-2 cursor-zoom-in"
                title="预览图片"
                role="button"
                tabIndex={0}
                onClick={() => void openPreview(image.filePath, image.fileName)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    void openPreview(image.filePath, image.fileName);
                  }
                }}
              >
                <img
                  src={toDisplaySrc(image.filePath)}
                  alt={image.fileName}
                  loading="lazy"
                  className="max-h-full max-w-full object-contain pointer-events-none"
                />
                {onCopyImage ? (
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCopyImage(image.filePath);
                      }}
                      className="cursor-pointer rounded border border-border bg-white/95 p-1.5 text-muted-foreground hover:text-foreground"
                      title="复制图片"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
              <figcaption className="border-t px-2 py-1.5 text-[11px] text-muted-foreground truncate">
                {image.fileName}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}
      {fallbackPreview ? (
        <ImagePreviewFallbackModal
          filePath={fallbackPreview.filePath}
          fileName={fallbackPreview.fileName}
          onClose={closeFallbackPreview}
        />
      ) : null}
    </section>
  );
}

export default function TaskDetailDrawer({
  task,
  relatedTasks,
  onClose,
  onOpenDirectory,
  onRestoreTask,
  canRestoreTask = true,
  isOpeningDirectory = false,
}: TaskDetailDrawerProps) {
  const desktopClient = useDesktopClient();

  const handleCopyImage = useCallback(async (filePath: string) => {
    if (!desktopClient) {
      alert('桌面能力不可用，无法复制图片');
      return;
    }

    try {
      await desktopClient.copyImageToClipboard({ filePath });
    } catch (err) {
      const message = err instanceof Error ? err.message : '复制图片失败';
      alert(message);
    }
  }, [desktopClient]);

  useEffect(() => {
    if (!task) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [task, onClose]);

  if (!task) {
    return null;
  }

  const batchTasks = relatedTasks && relatedTasks.length > 1 ? relatedTasks : [task];
  const isBatch = batchTasks.length > 1;
  const item = toTaskItem(task);
  const batchStatus = isBatch ? aggregateTaskStatuses(batchTasks) : item.status;
  const outputImages = isBatch
    ? batchTasks.flatMap((batchTask) => batchTask.outputs)
    : task.outputs;
  const canOpenDirectory = isBatch
    ? batchTasks.some((batchTask) => batchTask.status === 'Completed' && batchTask.outputs.length > 0)
    : task.status === 'Completed' && task.outputs.length > 0;
  const requestImages = task.request?.images ?? [];

  return (
    <div className="fixed inset-0 z-50" id="task-detail-drawer">
      <button
        type="button"
        aria-label="关闭任务详情"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <aside
        className={cn(
          'absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l bg-background shadow-xl',
          'animate-in slide-in-from-right duration-200',
        )}
        id="task-detail-drawer-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{isBatch ? '批量任务详情' : '任务详情'}</p>
            <h2 className="truncate text-lg font-semibold">{item.feature}</h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {isBatch ? `批量 · ${batchTasks.length} 项 · ${task.request?.outputBatchId?.slice(0, 8)}...` : item.id}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <section>
            <h3 className="text-sm font-medium mb-3">基本信息</h3>
            <dl>
              <ParamRow label="分类" value={task.category} />
              <ParamRow label="功能" value={task.feature} />
              <ParamRow label="状态" value={batchStatus} />
              <ParamRow label="创建时间" value={item.time} />
              <ParamRow label="批次" value={isBatch ? task.request?.outputBatchId : task.batchId} />
              {isBatch ? <ParamRow label="子任务数" value={batchTasks.length} /> : null}
              {task.outputDir ? <ParamRow label="输出目录" value={task.outputDir} /> : null}
            </dl>
          </section>

          {isBatch ? (
            <>
              <Separator />
              <section>
                <h3 className="text-sm font-medium mb-3">子任务</h3>
                <div className="space-y-2">
                  {batchTasks.map((batchTask) => (
                    <div
                      key={batchTask.taskId}
                      className="rounded-md border px-3 py-2 text-xs font-mono text-muted-foreground"
                    >
                      {batchTask.taskId.slice(0, 8)} · {batchTask.status} · {batchTask.outputs.length} 张
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          <Separator />

          <section>
            <h3 className="text-sm font-medium mb-3">{isBatch ? '代表任务参数' : '输入参数'}</h3>
            {task.request ? (
              buildRequestParams(task.request)
            ) : (
              <p className="text-sm text-muted-foreground">该任务未保存详细参数，仅可查看导入图片。</p>
            )}
            {requestImages.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">请求图片角色</p>
                {requestImages.map((image, index) => (
                  <div key={`${image.role}-${index}`} className="text-sm">
                    <Badge variant="secondary" className="mr-2">
                      {IMAGE_ROLE_LABELS[image.role]}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground break-all">
                      {image.path}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <Separator />

          <ImageGrid
            title="输入图片"
            images={task.imports}
            emptyText="无输入图片"
            onCopyImage={handleCopyImage}
          />

          <Separator />

          <ImageGrid
            title={isBatch ? `输出图片 (${outputImages.length})` : '输出图片'}
            images={outputImages}
            emptyText="暂无输出图片"
            onCopyImage={handleCopyImage}
          />

          {task.warnings?.length ? (
            <>
              <Separator />
              <section>
                <h3 className="text-sm font-medium mb-3">警告</h3>
                <ul className="space-y-2 text-sm text-amber-700">
                  {task.warnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>{warning}</li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}

          {task.error ? (
            <>
              <Separator />
              <section>
                <h3 className="text-sm font-medium mb-3">错误</h3>
                <p className="text-sm text-destructive">{task.error.message}</p>
              </section>
            </>
          ) : null}
        </div>

        <div className="border-t px-5 py-4 space-y-2">
          <Button
            variant="default"
            className="w-full gap-2"
            disabled={!canRestoreTask || !task.request?.feature}
            onClick={(event) => {
              event.stopPropagation();
              onRestoreTask?.(task);
              onClose();
            }}
          >
            <RotateCcw className="h-4 w-4" />
            还原到功能页
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2"
            disabled={!canOpenDirectory || isOpeningDirectory}
            onClick={(event) => {
              event.stopPropagation();
              void onOpenDirectory?.(task);
            }}
          >
            <FolderOpen className={cn('h-4 w-4', isOpeningDirectory && 'animate-pulse')} />
            {isOpeningDirectory ? '打开中...' : '打开输出目录'}
          </Button>
        </div>
      </aside>
    </div>
  );
}

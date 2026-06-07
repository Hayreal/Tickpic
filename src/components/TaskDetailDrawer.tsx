import { useEffect } from 'react';
import { X, FolderOpen, RotateCcw } from 'lucide-react';
import type { ImageRole, ImageTaskRequest, RegionInput } from '../shared/domain/imageFeatureApi';
import type { TaskRecord } from '../shared/domain/tasks';
import type { StoredImageRecord } from '../shared/domain/images';
import { toTaskItem } from '../features/tasks/taskMappers';
import { toDisplaySrc } from '../lib/fileUrl';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Separator } from '@/src/components/ui/separator';
import { cn } from '@/src/lib/utils';

interface TaskDetailDrawerProps {
  task: TaskRecord | null;
  onClose: () => void;
  onOpenDirectory?: (task: TaskRecord) => void;
  onRestoreTask?: (task: TaskRecord) => void;
  isOpeningDirectory?: boolean;
}

const IMAGE_ROLE_LABELS: Record<ImageRole, string> = {
  source: '源图',
  reference: '参考图',
  style: '风格图',
  product: '产品图',
  logo: 'Logo 图',
};

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
      <ParamRow label="出图数量" value={request.count} />
      <ParamRow label="产品名称" value={request.productName} />
      <ParamRow label="产品品类" value={request.productCategory} />
      <ParamRow
        label="卖点"
        value={request.sellingPoints?.length ? request.sellingPoints.join('、') : undefined}
      />
      <ParamRow label="容量/规格" value={request.capacity} />
      <ParamRow label="Logo 文字" value={request.logoText} />
      <ParamRow label="配色方案" value={request.colorScheme} />
      <ParamRow label="宽高比" value={request.aspectRatio} />
      <ParamRow
        label="展示产品"
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
}: {
  title: string;
  images: StoredImageRecord[];
  emptyText: string;
}) {
  return (
    <section>
      <h3 className="text-sm font-medium mb-3">{title}</h3>
      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {images.map((image) => (
            <figure
              key={image.id}
              className="rounded-lg border bg-white overflow-hidden"
            >
              <div className="aspect-square flex items-center justify-center p-2">
                <img
                  src={toDisplaySrc(image.filePath)}
                  alt={image.fileName}
                  loading="lazy"
                  className="max-h-full max-w-full object-contain"
                />
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
    </section>
  );
}

export default function TaskDetailDrawer({
  task,
  onClose,
  onOpenDirectory,
  onRestoreTask,
  isOpeningDirectory = false,
}: TaskDetailDrawerProps) {
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

  const item = toTaskItem(task);
  const canOpenDirectory = task.status === 'Completed' && task.outputs.length > 0;
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
            <p className="text-xs text-muted-foreground">任务详情</p>
            <h2 className="truncate text-lg font-semibold">{item.feature}</h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{item.id}</p>
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
              <ParamRow label="状态" value={item.status} />
              <ParamRow label="创建时间" value={item.time} />
              <ParamRow label="批次" value={task.batchId} />
              {task.outputDir ? <ParamRow label="输出目录" value={task.outputDir} /> : null}
            </dl>
          </section>

          <Separator />

          <section>
            <h3 className="text-sm font-medium mb-3">输入参数</h3>
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

          <ImageGrid title="输入图片" images={task.imports} emptyText="无输入图片" />

          <Separator />

          <ImageGrid title="输出图片" images={task.outputs} emptyText="暂无输出图片" />

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
            disabled={!task.request?.feature}
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

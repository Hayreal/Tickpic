import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Clock,
  FolderOpen,
  Maximize2,
  Copy,
} from 'lucide-react';
import type { StickerSubTab } from '../shared/view/ui';
import type { ImportBatch } from '../shared/domain/images';
import { useImageTask } from '../hooks/useImageTask';
import { useOpenOutputDirectory } from '../hooks/useOpenOutputDirectory';
import type { ImageTaskRequest, ImageFeature } from '../shared/domain/imageFeatureApi';
import ImageUploader from './ImageUploader';
import BatchRegionSelector from './BatchRegionSelector';
import {
  type RegionMap,
  pruneRegionMap,
  regionsFromMap,
} from '../lib/regionSelection';
import GenerationResult from './GenerationResult';
import ImageCountSelector, { DEFAULT_IMAGE_COUNT } from './ImageCountSelector';
import StickerProductRatioSelect from './StickerProductRatioSelect';
import StickerOutputQualitySelect from './StickerOutputQualitySelect';
import {
  DEFAULT_STICKER_OUTPUT_QUALITY,
  normalizeStickerAspectRatio,
  type StickerOutputQuality,
} from '../shared/domain/stickerOutputSpec';
import type { TaskRecord } from '../shared/domain/tasks';
import { getFeatureRoute } from '../shared/view/featureRoutes';
import { applyStickerRestore } from '../features/tasks/applyStickerRestore';
import {
  formatTaskBatchProgress,
  getTaskBatchProgress,
  hasPartialOrCompleteBatchResults,
  isTaskBatchInProgress,
} from '../features/tasks/taskProgress';
import { imageTaskRecordFromTaskRecord } from '../features/tasks/taskRestoreHelpers';
import { toDisplaySrc } from '../lib/fileUrl';
import { useOpenLocalImage } from '../hooks/useOpenLocalImage';
import ImagePreviewFallbackModal from './ImagePreviewFallbackModal';
import { useDesktopClient } from '../hooks/useDesktopClient';
import { useAppLogs } from '../hooks/useAppLogs';
import { filterLogsForTasks } from '../lib/taskLogs';
import GenerationTaskStatus from './GenerationTaskStatus';
import FeatureWorkspaceLayout from './FeatureWorkspaceLayout';
import FeatureParameterPanels, { REFERENCE_UPLOAD_STACK } from './FeatureParameterPanels';
import StickerParameterFields from './StickerParameterFields';
import {
  DEFAULT_STICKER_BRAND,
  STICKER_VARIATION_DIRECTION_OPTIONS,
  type StickerVariationDirectionSelection,
} from '../shared/domain/stickerPrompts';
import { formatAspectRatio, inferStickerSourceAspectRatio } from '../lib/aspectRatioFromImage';
import { cn } from '../lib/utils';

interface StickerGenProps {
  restoredTask?: TaskRecord | null;
  onRestoreConsumed?: () => void;
}

const FEATURE_MAP: Record<StickerSubTab, ImageFeature> = {
  copy: 'sticker_replica',
  variation: 'sticker_variation',
  original: 'sticker_original',
};

interface StickerVariationDirectionSelectProps {
  value: StickerVariationDirectionSelection;
  onChange: (value: StickerVariationDirectionSelection) => void;
}

function StickerVariationDirectionSelect({
  value,
  onChange,
}: StickerVariationDirectionSelectProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = STICKER_VARIATION_DIRECTION_OPTIONS.find((direction) => direction.value === value)
    ?? STICKER_VARIATION_DIRECTION_OPTIONS[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className={cn('relative min-w-0 space-y-2', open && 'z-30')} ref={containerRef}>
      <label className="ui-label" htmlFor="variation-direction-select">
        裂变方向
      </label>
      <button
        type="button"
        id="variation-direction-select"
        aria-label={`裂变方向 ${selected.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-xs shadow-sm transition-colors',
          'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open && 'border-primary/50 ring-2 ring-ring/30',
        )}
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold text-foreground">{selected.label}</span>
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="absolute left-0 top-full mt-1 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
          <ul
            id={listboxId}
            role="listbox"
            aria-label="裂变方向"
            className="max-h-72 overflow-auto p-1.5"
          >
            {STICKER_VARIATION_DIRECTION_OPTIONS.map((direction) => {
              const isSelected = direction.value === value;
              return (
                <li key={direction.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(direction.value);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors',
                      isSelected
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent/55',
                    )}
                  >
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                      {isSelected ? <Check className="size-3.5 text-primary" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold">{direction.label}</span>
                      {direction.prompt ? (
                        <span className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                          {direction.prompt}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function StickerGen({ restoredTask, onRestoreConsumed }: StickerGenProps) {
  const [subTab, setSubTab] = useState<StickerSubTab>('copy');
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);
  const isGenerationStartingRef = useRef(false);
  const desktopClient = useDesktopClient();
  const { logs, isLoading: isLoadingLogs } = useAppLogs(desktopClient);
  const { submitMany, bindTask, restoreTask, getTask, getTasks, getError, isSubmitting, reset } = useImageTask();
  const currentFeature = FEATURE_MAP[subTab];
  const activeTask = getTask(currentFeature);
  const activeTasks = getTasks(currentFeature);
  const error = getError(currentFeature);
  const { openActiveTaskDirectory } = useOpenOutputDirectory();
  const { openPreview, fallbackPreview, closeFallbackPreview } = useOpenLocalImage();

  const handleOpenOutputDirectory = async () => {
    if (!activeTask) return;

    try {
      await openActiveTaskDirectory(activeTask);
    } catch (err) {
      const message = err instanceof Error ? err.message : '打开目录失败';
      alert(message);
    }
  };

  const handleCopyGeneratedImage = async (filePath: string) => {
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
  };

  // STICKER COPY (Tab 1) state
  const [copyBatch, setCopyBatch] = useState<ImportBatch | null>(null);
  const [copyCount, setCopyCount] = useState<number>(DEFAULT_IMAGE_COUNT);
  const [copyAspectRatio, setCopyAspectRatio] = useState('auto');
  const [copyOutputQuality, setCopyOutputQuality] = useState<StickerOutputQuality>(DEFAULT_STICKER_OUTPUT_QUALITY);
  const [copyRatioValidation, setCopyRatioValidation] = useState<string>();

  // Copy Tab - New State
  const [copyLogo, setCopyLogo] = useState<ImportBatch | null>(null);
  const [copyBrand, setCopyBrand] = useState(DEFAULT_STICKER_BRAND);
  const [copyProductName, setCopyProductName] = useState('');
  const [copyMaterial, setCopyMaterial] = useState('');
  const [copySellingPoint, setCopySellingPoint] = useState('');
  const [copyCapacity, setCopyCapacity] = useState('');
  const [copyStyle, setCopyStyle] = useState('');
  const [copyColorBlockLayout, setCopyColorBlockLayout] = useState('');
  const [copyPrompt, setCopyPrompt] = useState('');
  const [copyColorScheme, setCopyColorScheme] = useState('');
  const [copyRegions, setCopyRegions] = useState<RegionMap>({});

  // STICKER VARIATION (Tab 2) state
  const [variationBatch, setVariationBatch] = useState<ImportBatch | null>(null);
  const [variationPrompt, setVariationPrompt] = useState('');
  const [variationCount, setVariationCount] = useState<number>(DEFAULT_IMAGE_COUNT);
  const [variationAspectRatio, setVariationAspectRatio] = useState('auto');
  const [variationOutputQuality, setVariationOutputQuality] = useState<StickerOutputQuality>(DEFAULT_STICKER_OUTPUT_QUALITY);
  const [variationRatioValidation, setVariationRatioValidation] = useState<string>();
  const [variationDirection, setVariationDirection] = useState<StickerVariationDirectionSelection>('');

  // Variation Tab - New State
  const [variationBrand, setVariationBrand] = useState(DEFAULT_STICKER_BRAND);
  const [variationProductName, setVariationProductName] = useState('');
  const [variationMaterial, setVariationMaterial] = useState('');
  const [variationSellingPoint, setVariationSellingPoint] = useState('');
  const [variationCapacity, setVariationCapacity] = useState('');
  const [variationStyle, setVariationStyle] = useState('');
  const [variationColorBlockLayout, setVariationColorBlockLayout] = useState('');
  const [variationColorScheme, setVariationColorScheme] = useState('');

  // STICKER ORIGINAL (Tab 3) state
  const [originalBatch, setOriginalBatch] = useState<ImportBatch | null>(null);
  const [originalCount, setOriginalCount] = useState<number>(DEFAULT_IMAGE_COUNT);
  const [originalAspectRatio, setOriginalAspectRatio] = useState('auto');
  const [originalOutputQuality, setOriginalOutputQuality] = useState<StickerOutputQuality>(DEFAULT_STICKER_OUTPUT_QUALITY);
  const [originalRatioValidation, setOriginalRatioValidation] = useState<string>();
  
  // Original Tab - New Structured State
  const [originalCategory, setOriginalCategory] = useState('');
  const [originalBrand, setOriginalBrand] = useState(DEFAULT_STICKER_BRAND);
  const [originalProductName, setOriginalProductName] = useState('');
  const [originalMaterial, setOriginalMaterial] = useState('');
  const [originalSellingPoint, setOriginalSellingPoint] = useState('');
  const [originalVolume, setOriginalVolume] = useState('');
  const [originalStyle, setOriginalStyle] = useState('');
  const [originalColorBlockLayout, setOriginalColorBlockLayout] = useState('');
  const [originalColorScheme, setOriginalColorScheme] = useState('');

  useEffect(() => {
    if (!restoredTask?.request?.feature) {
      return;
    }

    const route = getFeatureRoute(restoredTask.request.feature);
    if (route.tab !== 'sticker') {
      return;
    }

    const restored = applyStickerRestore(restoredTask);
    if (!restored) {
      return;
    }

    setSubTab(restored.subTab);
    setCopyBatch(restored.copyBatch);
    setCopyLogo(restored.copyLogo);
    setCopyBrand(restored.copyBrand);
    setCopyProductName(restored.copyProductName);
    setCopyMaterial(restored.copyMaterial);
    setCopySellingPoint(restored.copySellingPoint);
    setCopyCapacity(restored.copyCapacity);
    setCopyStyle(restored.copyStyle);
    setCopyColorBlockLayout(restored.copyColorBlockLayout);
    setCopyPrompt(restored.copyPrompt);
    setCopyColorScheme(restored.copyColorScheme);
    setCopyRegions(restored.copyRegions);
    setCopyCount(restored.copyCount);
    setCopyAspectRatio(restored.copyAspectRatio);
    setCopyOutputQuality(restored.copyOutputQuality);
    setVariationBatch(restored.variationBatch);
    setVariationBrand(restored.variationBrand);
    setVariationProductName(restored.variationProductName);
    setVariationMaterial(restored.variationMaterial);
    setVariationSellingPoint(restored.variationSellingPoint);
    setVariationCapacity(restored.variationCapacity);
    setVariationStyle(restored.variationStyle);
    setVariationColorBlockLayout(restored.variationColorBlockLayout);
    setVariationPrompt(restored.variationPrompt);
    setVariationCount(restored.variationCount);
    setVariationAspectRatio(restored.variationAspectRatio);
    setVariationOutputQuality(restored.variationOutputQuality);
    setVariationColorScheme(restored.variationColorScheme);
    setVariationDirection(restored.variationDirection);
    setOriginalBatch(restored.originalBatch);
    setOriginalCount(restored.originalCount);
    setOriginalAspectRatio(restored.originalAspectRatio);
    setOriginalOutputQuality(restored.originalOutputQuality);
    setOriginalCategory(restored.originalCategory);
    setOriginalBrand(restored.originalBrand);
    setOriginalProductName(restored.originalProductName);
    setOriginalMaterial(restored.originalMaterial);
    setOriginalSellingPoint(restored.originalSellingPoint);
    setOriginalVolume(restored.originalVolume);
    setOriginalStyle(restored.originalStyle);
    setOriginalColorBlockLayout(restored.originalColorBlockLayout);
    setOriginalColorScheme(restored.originalColorScheme);

    const fallbackTask = imageTaskRecordFromTaskRecord(restoredTask);
    if (fallbackTask) {
      restoreTask(fallbackTask);
      void bindTask(restoredTask.taskId, restoredTask.request.feature).catch(() => undefined);
      void desktopClient?.imageTask.get(restoredTask.taskId).then((liveTask) => {
        if (liveTask) {
          restoreTask(liveTask);
        }
      });
    }

    onRestoreConsumed?.();
  }, [restoredTask, bindTask, restoreTask, desktopClient, onRestoreConsumed]);

  const copyExpectedCount = (copyBatch?.images.length ?? 1) * copyCount;
  const variationExpectedCount = (variationBatch?.images.length ?? 1) * variationCount;
  const originalExpectedCount = originalCount;
  const copyProgress = getTaskBatchProgress(activeTasks, copyExpectedCount);
  const variationProgress = getTaskBatchProgress(activeTasks, variationExpectedCount);
  const originalProgress = getTaskBatchProgress(activeTasks, originalExpectedCount);
  const activeProgress = subTab === 'copy' ? copyProgress : subTab === 'variation' ? variationProgress : originalProgress;
  const activeCount = subTab === 'copy' ? copyExpectedCount : subTab === 'variation' ? variationExpectedCount : originalExpectedCount;
  const showTaskResults = hasPartialOrCompleteBatchResults(activeTasks);
  const taskInProgress = isTaskBatchInProgress(activeTasks);
  const activeResultItems = activeTasks.flatMap((task) => task.images.map((imageUrl, index) => ({
    id: `${task.taskId}-${index}`,
    imageUrl,
    taskId: task.taskId,
  })));
  const visibleResultCount = Math.min(activeResultItems.length, activeProgress.total);
  const taskLogs = useMemo(
    () => filterLogsForTasks(logs, activeTasks),
    [logs, activeTasks],
  );

  const resolveAspectRatio = async (
    selectedRatio: string,
    source?: { filePath: string },
    region?: { width: number; height: number } | null,
  ) => {
    if (selectedRatio !== 'auto') {
      return normalizeStickerAspectRatio(selectedRatio);
    }
    if (region && Number.isFinite(region.width) && Number.isFinite(region.height)
      && region.width > 0 && region.height > 0) {
      return formatAspectRatio(region.width, region.height);
    }
    if (source) {
      try {
        return await inferStickerSourceAspectRatio(source.filePath);
      } catch {
        // Fall back to a square output when the local image cannot be read.
      }
    }
    return '1:1';
  };

  const activeRatioValidation = subTab === 'copy'
    ? copyRatioValidation
    : subTab === 'variation'
      ? variationRatioValidation
      : originalRatioValidation;
  // Generation sequence run
  const runGeneration = async (type: StickerSubTab) => {
    if (isGenerationStartingRef.current) {
      return;
    }
    isGenerationStartingRef.current = true;

    try {
      if (type === 'copy' && !copyBatch) {
        alert('请先上传一张贴纸作为参考图片！');
        return;
      }
      if (type === 'variation' && !variationBatch) {
        alert('请先上传一张参考贴纸！');
        return;
      }
      if (type === 'original' && !originalCategory && !originalBrand && !originalSellingPoint) {
        alert('请输入产品类别、品牌或卖点！');
        return;
      }

      const requests: ImageTaskRequest[] = [];

      if (type === 'copy') {
      const logoImage = copyLogo?.images[0];
      for (const source of copyBatch?.images ?? []) {
        const region = copyRegions[source.filePath];
        const aspectRatio = await resolveAspectRatio(copyAspectRatio, source, region);
        for (let index = 0; index < copyCount; index += 1) {
          requests.push({
            feature: FEATURE_MAP[type],
            images: [
              { role: 'source', path: source.filePath },
              ...(logoImage ? [{ role: 'logo' as const, path: logoImage.filePath }] : []),
            ],
            count: 1,
            brand: copyBrand.trim() || DEFAULT_STICKER_BRAND,
            productName: copyProductName || undefined,
            material: copyMaterial || undefined,
            sellingPoints: copySellingPoint ? [copySellingPoint] : undefined,
            capacity: copyCapacity || undefined,
            style: copyStyle || undefined,
            colorBlockLayout: copyColorBlockLayout || undefined,
            prompt: copyPrompt || undefined,
            colorScheme: copyColorScheme || undefined,
            aspectRatio,
            outputQuality: copyOutputQuality,
            regions: regionsFromMap(copyRegions, source.filePath),
          });
        }
      }
      } else if (type === 'variation') {
      for (const source of variationBatch?.images ?? []) {
        const aspectRatio = await resolveAspectRatio(variationAspectRatio, source);
        for (let index = 0; index < variationCount; index += 1) {
          requests.push({
            feature: FEATURE_MAP[type],
            images: [{ role: 'source', path: source.filePath }],
            count: 1,
            brand: variationBrand.trim() || DEFAULT_STICKER_BRAND,
            productName: variationProductName || undefined,
            material: variationMaterial || undefined,
            sellingPoints: variationSellingPoint ? [variationSellingPoint] : undefined,
            capacity: variationCapacity || undefined,
            style: variationStyle || undefined,
            colorBlockLayout: variationColorBlockLayout || undefined,
            colorScheme: variationColorScheme || undefined,
            stickerVariationDirection: variationDirection || undefined,
            prompt: variationPrompt || undefined,
            aspectRatio,
            outputQuality: variationOutputQuality,
          });
        }
      }
      } else {
      const styleImages = originalBatch?.images ?? [];
      for (let index = 0; index < originalCount; index += 1) {
        const styleImage = styleImages.length > 0 ? styleImages[index % styleImages.length] : undefined;
        const aspectRatio = await resolveAspectRatio(originalAspectRatio, styleImage);
        requests.push({
          feature: FEATURE_MAP[type],
          images: styleImage ? [{ role: 'style', path: styleImage.filePath }] : [],
          count: 1,
          brand: originalBrand.trim() || DEFAULT_STICKER_BRAND,
          productName: originalProductName || undefined,
          productCategory: originalCategory || undefined,
          material: originalMaterial || undefined,
          sellingPoints: originalSellingPoint ? [originalSellingPoint] : undefined,
          capacity: originalVolume || undefined,
          style: originalStyle || undefined,
          colorBlockLayout: originalColorBlockLayout || undefined,
          colorScheme: originalColorScheme || undefined,
          aspectRatio,
          outputQuality: originalOutputQuality,
        });
      }
    }

      try {
        reset(FEATURE_MAP[type]);
        await submitMany(requests);
        setIsTaskDrawerOpen(true);
      } catch (err) {
        console.error('Task submission failed:', err);
      }
    } finally {
      isGenerationStartingRef.current = false;
    }
  };

  return (
    <div className="ui-page" id="sticker-gen-tab-content">
      {/* Top Secondary Tab Bar */}
      <div className="ui-subtab-bar" id="sticker-sub-tabs">
        <button 
          id="sticker-subtab-copy"
          onClick={() => { setSubTab('copy'); }}
          className={subTab === 'copy' ? 'ui-subtab-active' : 'ui-subtab'}
        >
          贴纸复刻
          {subTab === 'copy' && <div className="ui-subtab-indicator" />}
        </button>
        <button 
          id="sticker-subtab-variation"
          onClick={() => { setSubTab('variation'); }}
          className={subTab === 'variation' ? 'ui-subtab-active' : 'ui-subtab'}
        >
          贴纸裂变
          {subTab === 'variation' && <div className="ui-subtab-indicator" />}
        </button>
        <button 
          id="sticker-subtab-original"
          onClick={() => { setSubTab('original'); }}
          className={subTab === 'original' ? 'ui-subtab-active' : 'ui-subtab'}
        >
          贴纸原创
          {subTab === 'original' && <div className="ui-subtab-indicator" />}
        </button>
      </div>

      <FeatureWorkspaceLayout
        submitId={`submit-sticker-${subTab}`}
        onSubmit={() => runGeneration(subTab)}
        isSubmitting={isSubmitting}
        submitDisabled={Boolean(activeRatioValidation)}
        progressLabel={formatTaskBatchProgress(activeTasks, activeCount)}
        taskInProgress={taskInProgress}
        drawerOpen={isTaskDrawerOpen}
        onDrawerOpenChange={setIsTaskDrawerOpen}
        onOpenDirectory={handleOpenOutputDirectory}
        showOpenDirectory={showTaskResults}
        parameters={(
          <>
            {subTab === 'copy' && (
              <FeatureParameterPanels
                reference={(
                  <>
                    <div className={REFERENCE_UPLOAD_STACK}>
                      <ImageUploader
                        square
                        batch={copyBatch}
                        onBatchChange={(batch) => {
                          setCopyBatch(batch);
                          if (!batch) {
                            setCopyRegions({});
                            return;
                          }
                          setCopyRegions(pruneRegionMap(copyRegions, batch.images.map((image) => image.filePath)));
                        }}
                        page="sticker"
                        feature="copy"
                        label="参考贴纸"
                      />
                      <ImageUploader
                        square
                        batch={copyLogo}
                        onBatchChange={setCopyLogo}
                        page="sticker"
                        feature="logo"
                        label="Logo 图片"
                        optional
                        placeholder="点击、拖拽或粘贴上传 Logo"
                      />
                    </div>
                    {copyBatch && copyBatch.images.length > 0 && (
                      <BatchRegionSelector
                        images={copyBatch.images.map((image) => ({
                          path: image.filePath,
                          label: image.fileName,
                        }))}
                        imageRole="source"
                        regions={copyRegions}
                        onRegionsChange={setCopyRegions}
                        operationHint="extract sticker area"
                      />
                    )}
                  </>
                )}
                basic={(
                  <>
                    <StickerProductRatioSelect
                      id="copy-product-ratio-select"
                      value={copyAspectRatio}
                      onChange={setCopyAspectRatio}
                      outputQuality={copyOutputQuality}
                      onValidationChange={setCopyRatioValidation}
                    />
                    <StickerOutputQualitySelect value={copyOutputQuality} onChange={setCopyOutputQuality} />
                    <ImageCountSelector
                      id="copy-count-selector"
                      value={copyCount}
                      onChange={setCopyCount}
                    />
                  </>
                )}
                advanced={(
                  <>
                    <StickerParameterFields
                      prefix="copy"
                      brand={copyBrand}
                      onBrandChange={setCopyBrand}
                      productName={copyProductName}
                      onProductNameChange={setCopyProductName}
                      material={copyMaterial}
                      onMaterialChange={setCopyMaterial}
                      sellingPoint={copySellingPoint}
                      onSellingPointChange={setCopySellingPoint}
                      capacity={copyCapacity}
                      onCapacityChange={setCopyCapacity}
                      colorScheme={copyColorScheme}
                      onColorSchemeChange={setCopyColorScheme}
                      style={copyStyle}
                      onStyleChange={setCopyStyle}
                      colorBlockLayout={copyColorBlockLayout}
                      onColorBlockLayoutChange={setCopyColorBlockLayout}
                    />
                    <div className="space-y-2 sm:col-span-2">
                      <label className="ui-label">附加提示词</label>
                      <textarea
                        id="copy-prompt-input"
                        value={copyPrompt}
                        onChange={(e) => setCopyPrompt(e.target.value)}
                        placeholder="例如：换成 wkau，容量写 6PIECES，整体更清爽"
                        className="ui-textarea h-16 text-xs"
                      />
                    </div>
                  </>
                )}
              />
            )}

            {subTab === 'variation' && (
              <FeatureParameterPanels
                reference={(
                  <ImageUploader
                    batch={variationBatch}
                    onBatchChange={setVariationBatch}
                    page="sticker"
                    feature="variation"
                    label="参考贴纸"
                  />
                )}
                basic={(
                  <>
                    <div className="sm:col-span-3">
                      <StickerVariationDirectionSelect
                        value={variationDirection}
                        onChange={setVariationDirection}
                      />
                    </div>
                    <StickerProductRatioSelect
                      id="variation-product-ratio-select"
                      value={variationAspectRatio}
                      onChange={setVariationAspectRatio}
                      outputQuality={variationOutputQuality}
                      onValidationChange={setVariationRatioValidation}
                    />
                    <StickerOutputQualitySelect value={variationOutputQuality} onChange={setVariationOutputQuality} />
                    <ImageCountSelector
                      id="variation-count-selector"
                      value={variationCount}
                      onChange={setVariationCount}
                    />
                  </>
                )}
                advanced={(
                  <>
                    <StickerParameterFields
                      prefix="variation"
                      brand={variationBrand}
                      onBrandChange={setVariationBrand}
                      productName={variationProductName}
                      onProductNameChange={setVariationProductName}
                      material={variationMaterial}
                      onMaterialChange={setVariationMaterial}
                      sellingPoint={variationSellingPoint}
                      onSellingPointChange={setVariationSellingPoint}
                      capacity={variationCapacity}
                      onCapacityChange={setVariationCapacity}
                      colorScheme={variationColorScheme}
                      onColorSchemeChange={setVariationColorScheme}
                      style={variationStyle}
                      onStyleChange={setVariationStyle}
                      colorBlockLayout={variationColorBlockLayout}
                      onColorBlockLayoutChange={setVariationColorBlockLayout}
                    />
                    <div className="space-y-2 sm:col-span-2">
                      <label className="ui-label">附加提示词</label>
                      <textarea
                        id="variation-prompt-input"
                        value={variationPrompt}
                        onChange={(e) => setVariationPrompt(e.target.value)}
                        placeholder="描述想要微调的细节，例如：增加亮度、改为极简风格..."
                        className="ui-textarea h-16 text-xs"
                      />
                    </div>
                  </>
                )}
              />
            )}

            {subTab === 'original' && (
              <FeatureParameterPanels
                reference={(
                  <ImageUploader
                    batch={originalBatch}
                    onBatchChange={setOriginalBatch}
                    page="sticker"
                    feature="original"
                    label="风格参考图"
                    placeholder="点击、拖拽或粘贴上传图片"
                    optional
                  />
                )}
                basic={(
                  <>
                    <StickerProductRatioSelect
                      id="original-product-ratio-select"
                      value={originalAspectRatio}
                      onChange={setOriginalAspectRatio}
                      outputQuality={originalOutputQuality}
                      onValidationChange={setOriginalRatioValidation}
                    />
                    <StickerOutputQualitySelect value={originalOutputQuality} onChange={setOriginalOutputQuality} />
                    <ImageCountSelector
                      id="original-count-selector"
                      value={originalCount}
                      onChange={setOriginalCount}
                    />
                  </>
                )}
                advanced={(
                  <>
                    <div className="space-y-2">
                      <label className="ui-label">
                        产品品类 <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        id="original-category-input"
                        value={originalCategory}
                        onChange={(e) => setOriginalCategory(e.target.value)}
                        placeholder="例如：护肤品、饮料、零食"
                        className="ui-input-compact"
                      />
                    </div>
                    <StickerParameterFields
                      prefix="original"
                      brand={originalBrand}
                      onBrandChange={setOriginalBrand}
                      productName={originalProductName}
                      onProductNameChange={setOriginalProductName}
                      material={originalMaterial}
                      onMaterialChange={setOriginalMaterial}
                      sellingPoint={originalSellingPoint}
                      onSellingPointChange={setOriginalSellingPoint}
                      capacity={originalVolume}
                      onCapacityChange={setOriginalVolume}
                      colorScheme={originalColorScheme}
                      onColorSchemeChange={setOriginalColorScheme}
                      style={originalStyle}
                      onStyleChange={setOriginalStyle}
                      colorBlockLayout={originalColorBlockLayout}
                      onColorBlockLayoutChange={setOriginalColorBlockLayout}
                      brandRequired
                      sellingPointRequired
                      brandField={{ id: 'original-brand-input' }}
                      sellingPointField={{ id: 'original-selling-point-input' }}
                      capacityField={{
                        id: 'original-volume-input',
                        label: '容量/规格',
                        placeholder: '例如：50ml、100g、1L',
                      }}
                    />
                  </>
                )}
              />
            )}
          </>
        )}
        drawer={(
          <div className="space-y-4" id="sticker-workspace-preview">
            <GenerationTaskStatus
              tasks={activeTasks}
              fallbackCount={activeCount}
              error={error}
              logs={taskLogs}
              isLoadingLogs={isLoadingLogs}
            />

            {subTab === 'copy' && (visibleResultCount > 0 || taskInProgress) && (
              <div className={copyProgress.total <= 1 ? 'flex justify-start' : 'grid grid-cols-2 gap-3'} id="copy-result-grid">
                {Array.from({ length: copyProgress.total }).map((_, idx) => {
                  const item = activeResultItems[idx];
                  if (item) {
                    return (
                      <div
                        key={idx}
                        className="aspect-square max-h-40 bg-white border border-border hover:border-slate-300 rounded-lg overflow-hidden shadow-sm flex items-center justify-center relative p-2 group"
                      >
                        <button
                          type="button"
                          className="flex h-full w-full items-center justify-center cursor-zoom-in"
                          title="预览图片"
                          onClick={() => void openPreview(item.imageUrl, item.taskId)}
                        >
                          <img src={toDisplaySrc(item.imageUrl)} className="max-w-full max-h-full object-contain rounded-lg pointer-events-none" alt="Generated Sticker" />
                        </button>
                        <div className="absolute bottom-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 p-1.5 rounded-lg border border-border">
                          <button type="button" onClick={() => handleCopyGeneratedImage(item.imageUrl)} className="text-foreground hover:text-muted-foreground" title="复制图片"><Copy className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={handleOpenOutputDirectory} className="text-foreground hover:text-muted-foreground" title="打开目录"><FolderOpen className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className="aspect-square max-h-40 bg-surface-container-low border border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground font-medium"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-border">
                        <Clock className="w-4 h-4 text-slate-700" />
                      </div>
                      <span className="text-xs text-muted-foreground tracking-wide">等待生成</span>
                    </div>
                  );
                })}
              </div>
            )}

            {subTab === 'variation' && (visibleResultCount > 0 || taskInProgress) && (
              <div className="flex-1 min-h-0" id="variation-preview-results">
                <div className="grid grid-cols-1 gap-2">
                  {Array.from({ length: variationProgress.total }).map((_, idx) => {
                    const item = activeResultItems[idx];
                    return (
                    <div key={idx} className="aspect-square bg-white border border-border hover:border-border rounded-lg overflow-hidden p-3 flex items-center justify-center relative group">
                      {item ? (
                        <>
                          <button
                            type="button"
                            className="flex h-full w-full items-center justify-center cursor-zoom-in"
                            title="预览图片"
                            onClick={() => void openPreview(item.imageUrl, item.taskId)}
                          >
                            <img src={toDisplaySrc(item.imageUrl)} className="max-w-full max-h-full object-contain rounded-lg shadow-sm pointer-events-none" alt="Sticker result" />
                          </button>
                          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-white border border-border font-mono text-[9px] text-muted-foreground font-medium">
                            {item.taskId.slice(0, 8)}
                          </div>
                          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3 pointer-events-none">
                            <button type="button" onClick={() => handleCopyGeneratedImage(item.imageUrl)} className="pointer-events-auto cursor-pointer bg-primary hover:bg-slate-800 rounded p-2 text-primary-foreground shadow" title="复制图片"><Copy className="w-4 h-4" /></button>
                            <button type="button" onClick={handleOpenOutputDirectory} className="pointer-events-auto cursor-pointer bg-primary hover:bg-slate-800 rounded p-2 text-primary-foreground shadow" title="打开目录"><FolderOpen className="w-4 h-4" /></button>
                            <button type="button" onClick={() => void openPreview(item.imageUrl, item.taskId)} className="pointer-events-auto cursor-pointer bg-slate-800 hover:bg-slate-700 rounded p-2 text-foreground border border-slate-700" title="预览图片"><Maximize2 className="w-4 h-4" /></button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2.5 text-muted-foreground">
                          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-border">
                            <Clock className="w-4 h-4 text-slate-700" />
                          </div>
                          <span className="text-xs text-muted-foreground tracking-wide">等待生成</span>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {subTab === 'original' && (showTaskResults || taskInProgress) && (
              <GenerationResult
                mode="multi"
                state={taskInProgress ? 'running' : 'completed'}
                results={activeResultItems}
                placeholders={originalProgress.total}
                count={originalProgress.total}
                showCount
                progressLabel={formatTaskBatchProgress(activeTasks, originalExpectedCount)}
                onOpenDirectory={() => handleOpenOutputDirectory()}
                onOpenDirectoryAll={handleOpenOutputDirectory}
                onCopyImage={(item) => handleCopyGeneratedImage(item.imageUrl)}
              />
            )}
          </div>
        )}
      />
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

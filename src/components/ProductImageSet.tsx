import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { ImportBatch } from '../shared/domain/images';
import type {
  ComparisonIntensity,
  ComparisonLayout,
  ImageFeature,
  MultiSceneLayout,
  ProductEffectMode,
  ProductHandheldMode,
} from '../shared/domain/imageFeatureApi';
import type { TaskRecord } from '../shared/domain/tasks';
import type { ImageAspectRatioValue } from '../shared/view/imageAspectRatioOptions';
import type { ProductSetSubTab } from '../shared/view/ui';
import { useAppLogs } from '../hooks/useAppLogs';
import { useDesktopClient } from '../hooks/useDesktopClient';
import { useImageTask } from '../hooks/useImageTask';
import { useOpenOutputDirectory } from '../hooks/useOpenOutputDirectory';
import { usePrefillGlobalNegativePrompt } from '../hooks/usePrefillGlobalNegativePrompt';
import { applyProductImageSetRestore } from '../features/product-image-set/applyProductImageSetRestore';
import { buildProductImageSetRequests } from '../features/product-image-set/productImageSetRequests';
import {
  applyMainImageDisplayTags,
  formatMainImageDisplayTags,
  MAIN_IMAGE_DISPLAY_TAGS,
  MAIN_IMAGE_DISPLAY_TAG_LABELS,
  mainImageDisplayTagsFromFields,
  resizeMainImageExtraContentByIndex,
  toggleMainImageDisplayTag,
  type MainImageDisplayTag,
  type MainImageExtraContentSelection,
} from '../shared/domain/productSetMainImageExtraContent';
import { resizeShowProductByIndex } from '../shared/domain/productSetShowProductByIndex';
import { imageTaskRecordFromTaskRecord } from '../features/tasks/taskRestoreHelpers';
import { filterLogsForTasks } from '../lib/taskLogs';
import { cn } from '@/src/lib/utils';
import {
  formatTaskBatchProgress,
  getTaskBatchProgress,
  hasPartialOrCompleteBatchResults,
  isTaskBatchInProgress,
} from '../features/tasks/taskProgress';
import AspectRatioSelect from './AspectRatioSelect';
import FeatureParameterPanels from './FeatureParameterPanels';
import FeatureWorkspaceLayout from './FeatureWorkspaceLayout';
import GenerationResult from './GenerationResult';
import GenerationTaskStatus from './GenerationTaskStatus';
import ImageCountSelector, { DEFAULT_IMAGE_COUNT } from './ImageCountSelector';
import ImageUploader from './ImageUploader';

interface ProductImageSetProps {
  restoredTask?: TaskRecord | null;
  onRestoreConsumed?: () => void;
}

interface TabState {
  skuBatch: ImportBatch | null;
  aspectRatio: ImageAspectRatioValue;
  count: number;
  prompt: string;
  negativePrompt: string;
  scenePrompt: string;
  productHandheldMode: ProductHandheldMode;
  productEffectMode: ProductEffectMode;
  handheldReferenceId: string | null;
  comparisonLayout: ComparisonLayout;
  comparisonIntensity: ComparisonIntensity;
  showProduct: boolean;
  showProductByIndex: boolean[];
  mainImageExtraContentByIndex: MainImageExtraContentSelection[];
  multiSceneLayout: MultiSceneLayout;
}

const FEATURE_MAP: Record<ProductSetSubTab, ImageFeature> = {
  main: 'product_main_image',
  comparison: 'product_comparison_image',
  multiScene: 'product_multi_scene',
};

const TAB_LABELS: Record<ProductSetSubTab, string> = {
  main: '主图',
  comparison: '对比图',
  multiScene: '多场景图',
};

const DEFAULT_COUNT_BY_SUBTAB: Record<ProductSetSubTab, number> = {
  main: 3,
  comparison: 3,
  multiScene: 2,
};

const DEFAULT_ASPECT_RATIO_BY_SUBTAB: Record<ProductSetSubTab, ImageAspectRatioValue> = {
  main: '1:1',
  comparison: '1:1',
  multiScene: '1:1',
};

function defaultTabState(subTab: ProductSetSubTab): TabState {
  return {
    skuBatch: null,
    aspectRatio: DEFAULT_ASPECT_RATIO_BY_SUBTAB[subTab],
    count: DEFAULT_COUNT_BY_SUBTAB[subTab],
    prompt: '',
    negativePrompt: '',
    scenePrompt: '',
    productHandheldMode: 'not_handheld',
    productEffectMode: 'hide',
    handheldReferenceId: null,
    comparisonLayout: 'auto',
    comparisonIntensity: 'medium',
    showProduct: true,
    showProductByIndex: resizeShowProductByIndex(undefined, DEFAULT_COUNT_BY_SUBTAB[subTab]),
    mainImageExtraContentByIndex: resizeMainImageExtraContentByIndex(
      undefined,
      DEFAULT_COUNT_BY_SUBTAB[subTab],
      { preset: 'none', toggles: [] },
    ),
    multiSceneLayout: 'auto',
  };
}

export default function ProductImageSet({ restoredTask, onRestoreConsumed }: ProductImageSetProps) {
  const [subTab, setSubTab] = useState<ProductSetSubTab>('main');
  const [tabStates, setTabStates] = useState<Record<ProductSetSubTab, TabState>>({
    main: defaultTabState('main'),
    comparison: defaultTabState('comparison'),
    multiScene: defaultTabState('multiScene'),
  });
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);
  const [negativePromptRestoreReady, setNegativePromptRestoreReady] = useState(
    () => !restoredTask?.request?.feature,
  );
  const isSubmitPending = useRef(false);
  const restoringFeatureRef = useRef<ImageFeature | null>(null);
  const desktopClient = useDesktopClient();
  const { logs, isLoading: isLoadingLogs } = useAppLogs(desktopClient);
  const { submitMany, restoreTask, getTask, getTasks, getError, isSubmitting, reset } = useImageTask();
  const { openActiveTaskDirectory } = useOpenOutputDirectory();
  const activeState = tabStates[subTab];
  const currentFeature = FEATURE_MAP[subTab];
  const activeTasks = getTasks(currentFeature);
  const activeTask = getTask(currentFeature);
  const error = getError(currentFeature);

  const updateActiveState = (update: Partial<TabState>) => {
    setTabStates((current) => ({
      ...current,
      [subTab]: { ...current[subTab], ...update },
    }));
  };

  const applyGlobalNegativePrompt = useCallback((globalNegativePrompt: string) => {
    setTabStates((current) => {
      let changed = false;
      const next = { ...current };
      (Object.keys(next) as ProductSetSubTab[]).forEach((key) => {
        if (!next[key].negativePrompt.trim()) {
          next[key] = { ...next[key], negativePrompt: globalNegativePrompt };
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, []);

  usePrefillGlobalNegativePrompt(negativePromptRestoreReady, applyGlobalNegativePrompt);

  useEffect(() => {
    if (!restoredTask) {
      setNegativePromptRestoreReady(true);
      return;
    }

    const restored = applyProductImageSetRestore(restoredTask);
    if (!restored) {
      setNegativePromptRestoreReady(true);
      return;
    }

    setSubTab(restored.subTab);
    setTabStates((current) => ({
      ...current,
      [restored.subTab]: {
        skuBatch: restored.skuBatch,
        aspectRatio: restored.aspectRatio,
          count: restored.count,
          prompt: restored.prompt,
          negativePrompt: restored.negativePrompt,
          scenePrompt: restored.scenePrompt,
          productHandheldMode: restored.productHandheldMode,
          productEffectMode: restored.productEffectMode,
          handheldReferenceId: restored.handheldReferenceId,
          comparisonLayout: restored.comparisonLayout,
          comparisonIntensity: restored.comparisonIntensity,
          showProduct: restored.showProduct,
          showProductByIndex: restored.showProductByIndex,
          mainImageExtraContentByIndex: restored.mainImageExtraContentByIndex,
          multiSceneLayout: restored.multiSceneLayout,
      },
    }));

    let cancelled = false;
    const expectedFeature = restoredTask.request.feature;
    const previousFeature = restoringFeatureRef.current;
    if (previousFeature && previousFeature !== expectedFeature) {
      reset(previousFeature);
    }
    reset(expectedFeature);
    restoringFeatureRef.current = expectedFeature;
    const restorePersistedTask = (task: TaskRecord) => {
      if (cancelled) {
        return Promise.resolve();
      }

      const fallbackTask = imageTaskRecordFromTaskRecord(task);
      if (!fallbackTask) {
        return Promise.resolve();
      }

      restoreTask(fallbackTask);
      return desktopClient?.imageTask.get(task.taskId).then((liveTask) => {
        if (!cancelled && liveTask?.feature === fallbackTask.feature) {
          restoreTask(liveTask);
        }
      }).catch((error) => {
        console.error('恢复实时任务失败', task.taskId, error);
      }) ?? Promise.resolve();
    };

    void (async () => {
      const pendingLiveTasks = [restorePersistedTask(restoredTask)];
      const outputBatchId = restoredTask.request!.outputBatchId?.trim();
      if (outputBatchId && desktopClient) {
        const tasks = await desktopClient.listTasks().catch(() => []);
        if (cancelled) {
          return;
        }

        for (const task of tasks) {
          if (cancelled) {
            return;
          }

          if (
            task.taskId !== restoredTask.taskId
            && task.request?.feature === expectedFeature
            && task.request.outputBatchId?.trim() === outputBatchId
          ) {
            pendingLiveTasks.push(restorePersistedTask(task));
          }
        }
      }

      await Promise.all(pendingLiveTasks);
      if (!cancelled) {
        setNegativePromptRestoreReady(true);
        onRestoreConsumed?.();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restoredTask, restoreTask, reset, desktopClient, onRestoreConsumed]);

  const expectedCount = activeState.count;
  const activeProgress = getTaskBatchProgress(activeTasks, expectedCount);
  const showTaskResults = hasPartialOrCompleteBatchResults(activeTasks);
  const taskInProgress = isTaskBatchInProgress(activeTasks);
  const activeResultItems = activeTasks.flatMap((task) => task.images.map((imageUrl, index) => ({
    id: `${task.taskId}-${index}`,
    imageUrl,
    taskId: task.taskId,
    badge: 'Completed',
  })));
  const taskLogs = useMemo(() => filterLogsForTasks(logs, activeTasks), [logs, activeTasks]);

  const handleSubmit = async () => {
    if (isSubmitPending.current) {
      return;
    }

    isSubmitPending.current = true;
    try {
      const settings = await desktopClient?.settings.get();
      if (settings && activeState.count > settings.maxCount) {
        alert('生成数量不能超过系统最大数量');
        return;
      }

      const requests = buildProductImageSetRequests({
        subTab,
        skuPaths: activeState.skuBatch?.images.map((image) => image.filePath) ?? [],
        aspectRatio: activeState.aspectRatio,
        count: activeState.count,
        prompt: activeState.prompt,
        negativePrompt: activeState.negativePrompt,
        scenePrompt: activeState.scenePrompt,
        productHandheldMode: 'not_handheld',
        productEffectMode: 'hide',
        handheldReferencePath: null,
        comparisonLayout: activeState.comparisonLayout,
        comparisonIntensity: activeState.comparisonIntensity,
        showProduct: activeState.showProduct,
        showProductByIndex: activeState.showProductByIndex,
        mainImageExtraContentByIndex: activeState.mainImageExtraContentByIndex,
        multiSceneLayout: activeState.multiSceneLayout,
      });
      reset(currentFeature);
      await submitMany(requests, { forceOutputBatchId: true });
      setIsTaskDrawerOpen(true);
    } catch (error) {
      setIsTaskDrawerOpen(true);
      alert(error instanceof Error ? error.message : '提交失败');
    } finally {
      isSubmitPending.current = false;
    }
  };

  const handleOpenOutputDirectory = async () => {
    if (!activeTask) {
      return;
    }

    try {
      await openActiveTaskDirectory(activeTask);
    } catch (error) {
      alert(error instanceof Error ? error.message : '打开目录失败');
    }
  };

  const handleCopyGeneratedImage = async (filePath: string) => {
    if (!desktopClient) {
      alert('桌面能力不可用，无法复制图片');
      return;
    }

    try {
      await desktopClient.copyImageToClipboard({ filePath });
    } catch (error) {
      alert(error instanceof Error ? error.message : '复制图片失败');
    }
  };

  return (
    <div className="ui-page" id="product-image-set-tab-content">
      <div className="ui-subtab-bar" id="product-set-sub-tabs">
        {(Object.keys(FEATURE_MAP) as ProductSetSubTab[]).map((tab) => (
          <button
            key={tab}
            id={`product-set-subtab-${tab === 'multiScene' ? 'multi-scene' : tab}`}
            type="button"
            onClick={() => setSubTab(tab)}
            className={subTab === tab ? 'ui-subtab-active' : 'ui-subtab'}
          >
            {TAB_LABELS[tab]}
            {subTab === tab ? <div className="ui-subtab-indicator" /> : null}
          </button>
        ))}
      </div>

      <FeatureWorkspaceLayout
        submitId={`submit-product-set-${subTab}`}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        progressLabel={formatTaskBatchProgress(activeTasks, expectedCount)}
        taskInProgress={taskInProgress}
        onOpenDirectory={handleOpenOutputDirectory}
        showOpenDirectory={showTaskResults}
        drawerOpen={isTaskDrawerOpen}
        onDrawerOpenChange={setIsTaskDrawerOpen}
        parameters={(
          <FeatureParameterPanels
            reference={(
              <>
                <ImageUploader
                  batch={activeState.skuBatch}
                  onBatchChange={(skuBatch) => updateActiveState({ skuBatch })}
                  page="productSet"
                  feature={currentFeature}
                  label="SKU 产品图"
                />
              </>
            )}
            basic={(
              <>
                <AspectRatioSelect
                  id={`product-set-${subTab}-aspect-ratio`}
                  value={activeState.aspectRatio}
                  onChange={(aspectRatio) => updateActiveState({ aspectRatio })}
                  label="图片比例"
                />
                <ImageCountSelector
                  id={`product-set-${subTab}-count`}
                  value={activeState.count}
                  onChange={(count) => updateActiveState({
                    count,
                    ...(subTab === 'main'
                      ? {
                        showProductByIndex: resizeShowProductByIndex(activeState.showProductByIndex, count),
                        mainImageExtraContentByIndex: resizeMainImageExtraContentByIndex(
                          activeState.mainImageExtraContentByIndex,
                          count,
                          { preset: 'none', toggles: [] },
                        ),
                      }
                      : {}),
                  })}
                />
              </>
            )}
            advanced={(
              <>
                <TextAreaField
                  id={`product-set-${subTab}-prompt`}
                  label="提示词"
                  value={activeState.prompt}
                  onChange={(prompt) => updateActiveState({ prompt })}
                  placeholder="补充场景、风格、构图、光线或文案要求"
                />
                <TextAreaField
                  id={`product-set-${subTab}-negative-prompt`}
                  label="反向提示词"
                  value={activeState.negativePrompt}
                  onChange={(negativePrompt) => updateActiveState({ negativePrompt })}
                  placeholder="例如：避免多余产品、营销文字或不需要的效果"
                />
                {subTab !== 'multiScene' ? (
                  <TextAreaField
                    id={`product-set-${subTab}-scene-prompt`}
                    label="具体场景词"
                    value={activeState.scenePrompt}
                    onChange={(scenePrompt) => updateActiveState({ scenePrompt })}
                    placeholder="为空时由 AI 根据 SKU 自动选择场景"
                  />
                ) : null}
                {subTab === 'main' ? (
                  <div className="space-y-2 sm:col-span-2">
                    <p className="ui-label">展示内容</p>
                    <div className="space-y-2">
                    {Array.from({ length: activeState.count }, (_, index) => {
                      const showProduct = resizeShowProductByIndex(
                        activeState.showProductByIndex,
                        activeState.count,
                      )[index];
                      const extra = resizeMainImageExtraContentByIndex(
                        activeState.mainImageExtraContentByIndex,
                        activeState.count,
                        { preset: 'none', toggles: [] },
                      )[index];
                      const tags = mainImageDisplayTagsFromFields(showProduct, extra);
                      return (
                        <MainImageDisplayTagsSelect
                          key={`main-display-tags-${index + 1}`}
                          id={`product-set-main-display-tags-${index + 1}`}
                          imageLabel={`图 ${index + 1}`}
                          tags={tags}
                          onChange={(nextTags) => {
                            const applied = applyMainImageDisplayTags(nextTags);
                            const showProductByIndex = resizeShowProductByIndex(
                              activeState.showProductByIndex,
                              activeState.count,
                            );
                            const mainImageExtraContentByIndex = resizeMainImageExtraContentByIndex(
                              activeState.mainImageExtraContentByIndex,
                              activeState.count,
                              { preset: 'none', toggles: [] },
                            );
                            showProductByIndex[index] = applied.showProduct;
                            mainImageExtraContentByIndex[index] = applied.extra;
                            updateActiveState({ showProductByIndex, mainImageExtraContentByIndex });
                          }}
                        />
                      );
                    })}
                    </div>
                  </div>
                ) : null}
                {subTab === 'comparison' ? (
                  <>
                    <SegmentedControl
                      id="product-set-comparison-layout"
                      label="对比布局"
                      value={activeState.comparisonLayout}
                      options={[
                        ['auto', 'AI 自动'],
                        ['horizontal', '左右对比'],
                        ['vertical', '上下对比'],
                        ['grid_2x2', '四宫格对比'],
                        ['grid_3x2', '六宫格对比'],
                      ]}
                      onChange={(comparisonLayout) => updateActiveState({ comparisonLayout: comparisonLayout as ComparisonLayout })}
                    />
                    <SegmentedControl
                      id="product-set-comparison-show-product"
                      label="After 产品展示"
                      value={String(activeState.showProduct)}
                      options={[['true', '展示产品'], ['false', '不展示产品']]}
                      onChange={(showProduct) => updateActiveState({ showProduct: showProduct === 'true' })}
                    />
                    <SegmentedControl
                      id="product-set-comparison-intensity"
                      label="对比效果程度"
                      value={activeState.comparisonIntensity}
                      options={[['light', '轻度'], ['medium', '中度'], ['heavy', '重度']]}
                      onChange={(comparisonIntensity) => updateActiveState({ comparisonIntensity: comparisonIntensity as ComparisonIntensity })}
                    />
                  </>
                ) : null}
                {subTab === 'multiScene' ? (
                  <SegmentedControl
                    id="product-set-multiScene-layout"
                    label="画面模式"
                    value={activeState.multiSceneLayout}
                    options={[
                      ['auto', '自动多样'],
                      ['single', '单场景'],
                      ['collage', '拼图'],
                      ['grid', '宫格（自动变体）'],
                    ]}
                    onChange={(multiSceneLayout) => updateActiveState({ multiSceneLayout: multiSceneLayout as MultiSceneLayout })}
                  />
                ) : null}
              </>
            )}
          />
        )}
        drawer={(
          <div className="space-y-4" id="product-image-set-workspace-preview">
            <GenerationTaskStatus
              tasks={activeTasks}
              fallbackCount={expectedCount}
              error={error}
              logs={taskLogs}
              isLoadingLogs={isLoadingLogs}
            />
            {(showTaskResults || taskInProgress) ? (
              <GenerationResult
                mode={expectedCount <= 1 ? 'single' : 'multi'}
                state={taskInProgress ? 'running' : 'completed'}
                results={activeResultItems}
                placeholders={activeProgress.total}
                count={activeProgress.total}
                showCount
                progressLabel={formatTaskBatchProgress(activeTasks, expectedCount)}
                onOpenDirectory={handleOpenOutputDirectory}
                onOpenDirectoryAll={handleOpenOutputDirectory}
                onCopyImage={(item) => handleCopyGeneratedImage(item.imageUrl)}
              />
            ) : null}
          </div>
        )}
      />
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <label className="ui-label" htmlFor={id}>{label}</label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="ui-textarea h-20 text-xs"
      />
    </div>
  );
}

function MainImageDisplayTagsSelect({
  id,
  imageLabel,
  tags,
  onChange,
}: {
  id: string;
  imageLabel: string;
  tags: readonly MainImageDisplayTag[];
  onChange: (tags: MainImageDisplayTag[]) => void;
}) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const summary = tags.length > 0 ? formatMainImageDisplayTags(tags) : '请选择';

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
    <div
      className={cn('flex min-w-0 items-center gap-3', open && 'relative z-20')}
      ref={containerRef}
    >
      <span className="ui-label w-10 shrink-0">{imageLabel}</span>
      <div className="relative min-w-0 flex-1">
        <button
          type="button"
          id={id}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-xs shadow-sm transition-colors',
            'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            open && 'border-primary/40 ring-2 ring-ring/30',
          )}
        >
          <span className={cn('truncate font-medium', tags.length === 0 && 'text-muted-foreground')}>
            {summary}
          </span>
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
        {open ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={`${imageLabel}展示内容`}
            aria-multiselectable="true"
            className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
          >
            {MAIN_IMAGE_DISPLAY_TAGS.map((tag) => {
              const selected = tags.includes(tag);
              return (
                <li key={tag} role="presentation">
                  <button
                    type="button"
                    role="option"
                    id={`${id}-${tag}`}
                    aria-selected={selected}
                    onClick={() => onChange(toggleMainImageDisplayTag(tags, tag))}
                    className={cn(
                      'flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors',
                      selected ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/60',
                    )}
                  >
                    <span>{MAIN_IMAGE_DISPLAY_TAG_LABELS[tag]}</span>
                    {selected ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function SegmentedControl({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <span className="ui-label">{label}</span>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={label}>
        {options.map(([optionValue, optionLabel]) => (
          <button
            key={optionValue}
            id={`${id}-${optionValue}`}
            type="button"
            onClick={() => onChange(optionValue)}
            className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-bold transition-all ${value === optionValue ? 'ui-segment-active' : 'ui-segment-inactive'}`}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import type { ImportBatch } from '../shared/domain/images';
import type { TaskRecord } from '../shared/domain/tasks';
import type { ImageAspectRatioValue } from '../shared/view/imageAspectRatioOptions';
import type { SkuSubTab } from '../shared/view/ui';
import {
  DEFAULT_SKU_HIT_MAIN_COUNT,
  DEFAULT_SKU_ORIGINAL_COUNT,
  DEFAULT_SKU_REPLICA_COUNT,
  DEFAULT_SKU_VARIATION_COUNT,
  SKU_IMAGE_COUNT_OPTIONS,
} from '../shared/view/skuCountOptions';
import { useAppLogs } from '../hooks/useAppLogs';
import { useDesktopClient } from '../hooks/useDesktopClient';
import { useImageTask } from '../hooks/useImageTask';
import { useOpenOutputDirectory } from '../hooks/useOpenOutputDirectory';
import { applySkuImageGenRestore } from '../features/sku-image-gen/applySkuImageGenRestore';
import { buildSkuImageGenRequests, getSkuImageGenFeature } from '../features/sku-image-gen/skuImageGenRequests';
import { imageTaskRecordFromTaskRecord } from '../features/tasks/taskRestoreHelpers';
import { filterLogsForTasks } from '../lib/taskLogs';
import {
  formatTaskBatchProgress,
  getTaskBatchProgress,
  hasPartialOrCompleteBatchResults,
  isTaskBatchInProgress,
} from '../features/tasks/taskProgress';
import { getFeatureRoute } from '../shared/view/featureRoutes';
import AspectRatioSelect, { DEFAULT_IMAGE_ASPECT_RATIO } from './AspectRatioSelect';
import FeatureParameterPanels, { REFERENCE_UPLOAD_STACK } from './FeatureParameterPanels';
import FeatureWorkspaceLayout from './FeatureWorkspaceLayout';
import GenerationResult from './GenerationResult';
import GenerationTaskStatus from './GenerationTaskStatus';
import ImageCountSelector from './ImageCountSelector';
import ImageUploader from './ImageUploader';
import SkuNegativePromptField from './SkuNegativePromptField';
import SkuParameterFields from './SkuParameterFields';

interface SkuGenProps {
  restoredTask?: TaskRecord | null;
  onRestoreConsumed?: () => void;
}

interface SkuTabState {
  skuBatch: ImportBatch | null;
  referenceBatch: ImportBatch | null;
  aspectRatio: ImageAspectRatioValue;
  count: number;
  brand: string;
  productName: string;
  capacity: string;
  prompt: string;
  negativePrompt: string;
}

const TAB_LABELS: Record<SkuSubTab, string> = {
  replica: '复刻',
  variation: '裂变',
  original: '原创',
  hitMain: '爆款主图',
};

const DEFAULT_COUNT_BY_SUBTAB: Record<SkuSubTab, number> = {
  replica: DEFAULT_SKU_REPLICA_COUNT,
  variation: DEFAULT_SKU_VARIATION_COUNT,
  original: DEFAULT_SKU_ORIGINAL_COUNT,
  hitMain: DEFAULT_SKU_HIT_MAIN_COUNT,
};

function defaultTabState(subTab: SkuSubTab): SkuTabState {
  return {
    skuBatch: null,
    referenceBatch: null,
    aspectRatio: subTab === 'hitMain' ? '1:1' : DEFAULT_IMAGE_ASPECT_RATIO,
    count: DEFAULT_COUNT_BY_SUBTAB[subTab],
    brand: '',
    productName: '',
    capacity: '',
    prompt: '',
    negativePrompt: '',
  };
}

function renderParameterPanels(
  subTab: SkuSubTab,
  state: SkuTabState,
  onChange: (update: Partial<SkuTabState>) => void,
) {
  const referenceRequired = subTab === 'replica' || subTab === 'hitMain';
  const referenceLabel = subTab === 'hitMain' ? '爆款主图参考' : '参考图';
  const referencePlaceholder = subTab === 'hitMain'
    ? '上传一张爆款电商主图作卖点与场景参考'
    : '上传包装设计参考图，可多张';
  const promptPlaceholder = subTab === 'replica'
    ? '例如：品牌改为 wkau，容量 45ml，排版更协调'
    : subTab === 'variation'
      ? '例如：差异化再大一点，不要太像参考图'
      : subTab === 'hitMain'
        ? '例如：标题改成 WHITE RADIATOR REPAIR，对比更强，产品再大一点'
        : '例如：墙面修补膏，自由发挥，适合贴瓶的高级感';

  return (
    <FeatureParameterPanels
      reference={(
        <div className={REFERENCE_UPLOAD_STACK}>
          <ImageUploader
            batch={state.skuBatch}
            onBatchChange={(batch) => onChange({ skuBatch: batch })}
            page="sku"
            feature={subTab}
            label="SKU 图"
            placeholder="上传 SKU 图、尺寸图或包材渲染图"
          />
          <ImageUploader
            batch={state.referenceBatch}
            onBatchChange={(batch) => onChange({ referenceBatch: batch })}
            page="sku"
            feature={`${subTab}-reference`}
            label={referenceLabel}
            placeholder={referencePlaceholder}
            optional={!referenceRequired}
          />
        </div>
      )}
      basic={(
        <>
          <AspectRatioSelect
            id={`${subTab}-aspect-ratio-select`}
            value={state.aspectRatio}
            onChange={(aspectRatio) => onChange({ aspectRatio })}
            label="图片比例"
          />
          <ImageCountSelector
            id={`${subTab}-count-selector`}
            value={state.count}
            onChange={(count) => onChange({ count })}
            options={SKU_IMAGE_COUNT_OPTIONS}
          />
        </>
      )}
      advanced={(
        <>
          <SkuParameterFields
            prefix={subTab}
            brand={state.brand}
            onBrandChange={(brand) => onChange({ brand })}
            productName={state.productName}
            onProductNameChange={(productName) => onChange({ productName })}
            capacity={state.capacity}
            onCapacityChange={(capacity) => onChange({ capacity })}
            productNameRequired={subTab === 'original'}
          />
          <div className="space-y-2 sm:col-span-2">
            <label className="ui-label" htmlFor={`${subTab}-prompt-input`}>附加提示词</label>
            <textarea
              id={`${subTab}-prompt-input`}
              value={state.prompt}
              onChange={(event) => onChange({ prompt: event.target.value })}
              placeholder={promptPlaceholder}
              className="ui-textarea h-16 text-xs"
            />
          </div>
          <SkuNegativePromptField
            prefix={subTab}
            value={state.negativePrompt}
            onChange={(negativePrompt) => onChange({ negativePrompt })}
          />
        </>
      )}
    />
  );
}

export default function SkuGen({ restoredTask, onRestoreConsumed }: SkuGenProps) {
  const [subTab, setSubTab] = useState<SkuSubTab>('replica');
  const [tabStates, setTabStates] = useState<Record<SkuSubTab, SkuTabState>>({
    replica: defaultTabState('replica'),
    variation: defaultTabState('variation'),
    original: defaultTabState('original'),
    hitMain: defaultTabState('hitMain'),
  });
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);
  const desktopClient = useDesktopClient();
  const { logs, isLoading: isLoadingLogs } = useAppLogs(desktopClient);
  const { submitMany, bindTask, restoreTask, getTask, getTasks, getError, isSubmitting, reset } = useImageTask();
  const { openActiveTaskDirectory } = useOpenOutputDirectory();

  const activeState = tabStates[subTab];
  const currentFeature = getSkuImageGenFeature(subTab);
  const activeTasks = getTasks(currentFeature);
  const activeTask = getTask(currentFeature);
  const error = getError(currentFeature);

  const updateActiveState = (update: Partial<SkuTabState>) => {
    setTabStates((current) => ({
      ...current,
      [subTab]: { ...current[subTab], ...update },
    }));
  };

  useEffect(() => {
    if (!restoredTask?.request?.feature) {
      return;
    }

    const route = getFeatureRoute(restoredTask.request.feature);
    if (route.tab !== 'sku') {
      return;
    }

    const restored = applySkuImageGenRestore(restoredTask);
    if (!restored) {
      return;
    }

    setSubTab(restored.subTab);
    setTabStates({
      replica: restored.replica,
      variation: restored.variation,
      original: restored.original,
      hitMain: restored.hitMain,
    });

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

  const expectedCount = activeState.count;
  const activeProgress = getTaskBatchProgress(activeTasks, expectedCount);
  const showTaskResults = hasPartialOrCompleteBatchResults(activeTasks);
  const taskInProgress = isTaskBatchInProgress(activeTasks);
  const activeResultItems = activeTasks.flatMap((task) => task.images.map((imageUrl, index) => ({
    id: `${task.taskId}-${index}`,
    imageUrl,
    taskId: task.taskId,
  })));
  const taskLogs = useMemo(
    () => filterLogsForTasks(logs, activeTasks),
    [logs, activeTasks],
  );

  const handleOpenOutputDirectory = async () => {
    if (!activeTask) {
      return;
    }

    try {
      await openActiveTaskDirectory(activeTask);
    } catch (err) {
      alert(err instanceof Error ? err.message : '打开目录失败');
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
      alert(err instanceof Error ? err.message : '复制图片失败');
    }
  };

  const runGeneration = async (type: SkuSubTab) => {
    const state = tabStates[type];

    try {
      const requests = buildSkuImageGenRequests({
        subTab: type,
        skuPath: state.skuBatch?.images[0]?.filePath ?? '',
        referencePaths: state.referenceBatch?.images.map((image) => image.filePath) ?? [],
        aspectRatio: state.aspectRatio,
        count: state.count,
        brand: state.brand,
        productName: state.productName,
        capacity: state.capacity,
        prompt: state.prompt,
        negativePrompt: state.negativePrompt,
      });
      reset(getSkuImageGenFeature(type));
      await submitMany(requests);
      setIsTaskDrawerOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '提交失败');
    }
  };

  return (
    <div className="ui-page" id="sku-gen-tab-content">
      <div className="ui-subtab-bar" id="sku-sub-tabs">
        {(Object.keys(TAB_LABELS) as SkuSubTab[]).map((tab) => (
          <button
            key={tab}
            id={`sku-subtab-${tab}`}
            type="button"
            onClick={() => setSubTab(tab)}
            className={subTab === tab ? 'ui-subtab-active' : 'ui-subtab'}
          >
            {TAB_LABELS[tab]}
            {subTab === tab && <div className="ui-subtab-indicator" />}
          </button>
        ))}
      </div>

      <FeatureWorkspaceLayout
        submitId={`submit-sku-${subTab}`}
        onSubmit={() => runGeneration(subTab)}
        isSubmitting={isSubmitting}
        progressLabel={formatTaskBatchProgress(activeTasks, expectedCount)}
        taskInProgress={taskInProgress}
        drawerOpen={isTaskDrawerOpen}
        onDrawerOpenChange={setIsTaskDrawerOpen}
        onOpenDirectory={handleOpenOutputDirectory}
        showOpenDirectory={showTaskResults}
        parameters={renderParameterPanels(subTab, activeState, updateActiveState)}
        drawer={(
          <div className="space-y-4" id="sku-workspace-preview">
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

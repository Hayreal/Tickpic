import React, { useEffect, useMemo, useState } from 'react';
import {
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
import AspectRatioSelect, { DEFAULT_IMAGE_ASPECT_RATIO } from './AspectRatioSelect';
import ImageCountSelector from './ImageCountSelector';
import type { ImageAspectRatioValue } from '../shared/view/imageAspectRatioOptions';
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

interface StickerGenProps {
  restoredTask?: TaskRecord | null;
  onRestoreConsumed?: () => void;
}

const FEATURE_MAP: Record<StickerSubTab, ImageFeature> = {
  copy: 'sticker_replica',
  variation: 'sticker_variation',
  original: 'sticker_original',
};

export default function StickerGen({ restoredTask, onRestoreConsumed }: StickerGenProps) {
  const [subTab, setSubTab] = useState<StickerSubTab>('copy');
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);
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
  const [copyCount, setCopyCount] = useState<number>(1);
  
  // Copy Tab - New State
  const [copyLogo, setCopyLogo] = useState<ImportBatch | null>(null);
  const [copyProductName, setCopyProductName] = useState('');
  const [copyLogoText, setCopyLogoText] = useState('');
  const [copyPrompt, setCopyPrompt] = useState('');
  const [copyColorScheme, setCopyColorScheme] = useState('');
  const [copyAspectRatio, setCopyAspectRatio] = useState<ImageAspectRatioValue>(DEFAULT_IMAGE_ASPECT_RATIO);
  const [copyRegions, setCopyRegions] = useState<RegionMap>({});

  // STICKER VARIATION (Tab 2) state
  const [variationBatch, setVariationBatch] = useState<ImportBatch | null>(null);
  const [variationPrompt, setVariationPrompt] = useState('');
  const [variationCount, setVariationCount] = useState<number>(4);
  const [variationAspectRatio, setVariationAspectRatio] = useState<ImageAspectRatioValue>(DEFAULT_IMAGE_ASPECT_RATIO);
  
  // Variation Tab - New State
  const [variationColorScheme, setVariationColorScheme] = useState('');

  // STICKER ORIGINAL (Tab 3) state
  const [originalBatch, setOriginalBatch] = useState<ImportBatch | null>(null);
  const [originalCount, setOriginalCount] = useState<number>(4);
  const [originalAspectRatio, setOriginalAspectRatio] = useState<ImageAspectRatioValue>(DEFAULT_IMAGE_ASPECT_RATIO);
  
  // Original Tab - New Structured State
  const [originalCategory, setOriginalCategory] = useState('');
  const [originalBrand, setOriginalBrand] = useState('');
  const [originalSellingPoint, setOriginalSellingPoint] = useState('');
  const [originalVolume, setOriginalVolume] = useState('');
  const [originalStyle, setOriginalStyle] = useState('');
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
    setCopyProductName(restored.copyProductName);
    setCopyLogoText(restored.copyLogoText);
    setCopyPrompt(restored.copyPrompt);
    setCopyColorScheme(restored.copyColorScheme);
    setCopyAspectRatio(restored.copyAspectRatio);
    setCopyRegions(restored.copyRegions);
    setCopyCount(restored.copyCount);
    setVariationBatch(restored.variationBatch);
    setVariationPrompt(restored.variationPrompt);
    setVariationCount(restored.variationCount);
    setVariationAspectRatio(restored.variationAspectRatio);
    setVariationColorScheme(restored.variationColorScheme);
    setOriginalBatch(restored.originalBatch);
    setOriginalCount(restored.originalCount);
    setOriginalAspectRatio(restored.originalAspectRatio);
    setOriginalCategory(restored.originalCategory);
    setOriginalBrand(restored.originalBrand);
    setOriginalSellingPoint(restored.originalSellingPoint);
    setOriginalVolume(restored.originalVolume);
    setOriginalStyle(restored.originalStyle);
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
  // Generation sequence run
  const runGeneration = async (type: StickerSubTab) => {
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
        for (let index = 0; index < copyCount; index += 1) {
          requests.push({
            feature: FEATURE_MAP[type],
            images: [
              { role: 'source', path: source.filePath },
              ...(logoImage ? [{ role: 'logo' as const, path: logoImage.filePath }] : []),
            ],
            count: 1,
            prompt: copyPrompt || undefined,
            productName: copyProductName || undefined,
            logoText: copyLogoText || undefined,
            colorScheme: copyColorScheme || undefined,
            aspectRatio: copyAspectRatio,
            regions: regionsFromMap(copyRegions, source.filePath),
          });
        }
      }
    } else if (type === 'variation') {
      for (const source of variationBatch?.images ?? []) {
        for (let index = 0; index < variationCount; index += 1) {
          requests.push({
            feature: FEATURE_MAP[type],
            images: [{ role: 'source', path: source.filePath }],
            count: 1,
            colorScheme: variationColorScheme || undefined,
            prompt: variationPrompt || undefined,
            aspectRatio: variationAspectRatio,
          });
        }
      }
    } else {
      const styleImages = originalBatch?.images ?? [];
      for (let index = 0; index < originalCount; index += 1) {
        const styleImage = styleImages.length > 0 ? styleImages[index % styleImages.length] : undefined;
        requests.push({
          feature: FEATURE_MAP[type],
          images: styleImage ? [{ role: 'style', path: styleImage.filePath }] : [],
          count: 1,
          productName: originalBrand || undefined,
          productCategory: originalCategory || undefined,
          sellingPoints: originalSellingPoint ? [originalSellingPoint] : undefined,
          capacity: originalVolume || undefined,
          logoText: originalBrand || undefined,
          colorScheme: originalColorScheme || undefined,
          aspectRatio: originalAspectRatio,
          prompt: originalStyle ? `Style: ${originalStyle}` : undefined,
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
                    <AspectRatioSelect
                      id="copy-aspect-ratio-select"
                      value={copyAspectRatio}
                      onChange={setCopyAspectRatio}
                      label="图片比例"
                    />
                    <ImageCountSelector
                      id="copy-count-selector"
                      value={copyCount}
                      onChange={setCopyCount}
                    />
                  </>
                )}
                advanced={(
                  <>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="ui-label">产品名称</label>
                      <input
                        type="text"
                        id="copy-product-name-input"
                        value={copyProductName}
                        onChange={(e) => setCopyProductName(e.target.value)}
                        placeholder="请输入产品名称"
                        className="ui-input-compact"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="ui-label">Logo 文字</label>
                      <input
                        type="text"
                        id="copy-logo-text-input"
                        value={copyLogoText}
                        onChange={(e) => setCopyLogoText(e.target.value)}
                        placeholder="例如：wkau、LUMO"
                        className="ui-input-compact"
                      />
                    </div>
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
                    <div className="space-y-2">
                      <label className="ui-label">色系</label>
                      <input
                        type="text"
                        id="copy-color-scheme-input"
                        value={copyColorScheme}
                        onChange={(e) => setCopyColorScheme(e.target.value)}
                        placeholder="例如：莫兰迪色、高对比度、黑白"
                        className="ui-input-compact"
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
                    <AspectRatioSelect
                      id="variation-aspect-ratio-select"
                      value={variationAspectRatio}
                      onChange={setVariationAspectRatio}
                      label="图片比例"
                    />
                    <ImageCountSelector
                      id="variation-count-selector"
                      value={variationCount}
                      onChange={setVariationCount}
                    />
                  </>
                )}
                advanced={(
                  <>
                    <div className="space-y-2">
                      <label className="ui-label">色系</label>
                      <input
                        type="text"
                        id="variation-color-scheme-input"
                        value={variationColorScheme}
                        onChange={(e) => setVariationColorScheme(e.target.value)}
                        placeholder="例如：莫兰迪色、高对比度、黑白"
                        className="ui-input-compact"
                      />
                    </div>
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
                    <AspectRatioSelect
                      id="original-aspect-ratio-select"
                      value={originalAspectRatio}
                      onChange={setOriginalAspectRatio}
                      label="图片比例"
                    />
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
                    <div className="space-y-2">
                      <label className="ui-label">
                        品牌 <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        id="original-brand-input"
                        value={originalBrand}
                        onChange={(e) => setOriginalBrand(e.target.value)}
                        placeholder="请输入品牌名称"
                        className="ui-input-compact"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="ui-label">
                        卖点 <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        id="original-selling-point-input"
                        value={originalSellingPoint}
                        onChange={(e) => setOriginalSellingPoint(e.target.value)}
                        placeholder="例如：持久保湿、0糖0卡"
                        className="ui-input-compact"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="ui-label">容量/规格</label>
                      <input
                        type="text"
                        id="original-volume-input"
                        value={originalVolume}
                        onChange={(e) => setOriginalVolume(e.target.value)}
                        placeholder="例如：50ml、100g、1L"
                        className="ui-input-compact"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="ui-label">风格</label>
                      <input
                        type="text"
                        id="original-style-input"
                        value={originalStyle}
                        onChange={(e) => setOriginalStyle(e.target.value)}
                        placeholder="例如：极简、赛博朋克、水彩"
                        className="ui-input-compact"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="ui-label">色系</label>
                      <input
                        type="text"
                        id="original-color-scheme-input"
                        value={originalColorScheme}
                        onChange={(e) => setOriginalColorScheme(e.target.value)}
                        placeholder="例如：莫兰迪色、高对比度、黑白"
                        className="ui-input-compact"
                      />
                    </div>
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

import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock,
} from 'lucide-react';
import type { ProductSubTab } from '../shared/view/ui';
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
import ReplaceProductModelSelect, { REPLACE_PRODUCT_MODEL_DEFAULT } from './ReplaceProductModelSelect';
import { resolveReplaceProductModelOverrides } from '../shared/view/replaceProductModelOptions';
import type { ReplaceProductModelSelection } from '../shared/view/replaceProductModelOptions';
import type { ImageAspectRatioValue } from '../shared/view/imageAspectRatioOptions';
import type { TaskRecord } from '../shared/domain/tasks';
import { getFeatureRoute } from '../shared/view/featureRoutes';
import { applyProductRestore } from '../features/tasks/applyProductRestore';
import {
  formatTaskBatchProgress,
  getTaskBatchProgress,
  hasPartialOrCompleteBatchResults,
  isTaskBatchInProgress,
} from '../features/tasks/taskProgress';
import { imageTaskRecordFromTaskRecord } from '../features/tasks/taskRestoreHelpers';
import { useDesktopClient } from '../hooks/useDesktopClient';
import { useAppLogs } from '../hooks/useAppLogs';
import { filterLogsForTasks } from '../lib/taskLogs';
import GenerationTaskStatus from './GenerationTaskStatus';
import FeatureWorkspaceLayout from './FeatureWorkspaceLayout';
import FeatureParameterPanels, { REFERENCE_UPLOAD_STACK } from './FeatureParameterPanels';

interface ProductProcessingProps {
  restoredTask?: TaskRecord | null;
  onRestoreConsumed?: () => void;
}

const FEATURE_MAP: Record<ProductSubTab, ImageFeature> = {
  remove: 'remove_product',
  replace: 'replace_product',
  logo: 'replace_logo',
  theme: 'main_image_asset_variation',
  sceneVariation: 'scene_variation',
  scene: 'create_new_scene',
  promptAsset: 'prompt_only_main_asset',
};

function syncBatchRegions(
  batch: ImportBatch | null,
  regions: RegionMap,
  setRegions: (value: RegionMap) => void,
) {
  if (!batch) {
    setRegions({});
    return;
  }

  setRegions(pruneRegionMap(regions, batch.images.map((image) => image.filePath)));
}

function ShowProductToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="ui-label">展示具体产品</label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`cursor-pointer py-2 rounded-lg text-xs font-bold transition-all border ${!value ? 'ui-segment-active' : 'ui-segment-inactive'}`}
        >
          不展示
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`cursor-pointer py-2 rounded-lg text-xs font-bold transition-all border ${value ? 'ui-segment-active' : 'ui-segment-inactive'}`}
        >
          展示
        </button>
      </div>
    </div>
  );
}

export default function ProductProcessing({ restoredTask, onRestoreConsumed }: ProductProcessingProps) {
  const [subTab, setSubTab] = useState<ProductSubTab>('remove');
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);
  const desktopClient = useDesktopClient();
  const { logs, isLoading: isLoadingLogs } = useAppLogs(desktopClient);
  const { submitMany, bindTask, restoreTask, getTask, getTasks, getError, isSubmitting, reset } = useImageTask();
  const currentFeature = FEATURE_MAP[subTab];
  const activeTasks = getTasks(currentFeature);
  const activeTask = getTask(currentFeature);
  const error = getError(currentFeature);
  const { openActiveTaskDirectory } = useOpenOutputDirectory();

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

  // TAB 1: REMOVE PRODUCT state
  const [removeBatch, setRemoveBatch] = useState<ImportBatch | null>(null);
  const [removeDesc, setRemoveDesc] = useState('');
  const [removeRegions, setRemoveRegions] = useState<RegionMap>({});
  const [removeAspectRatio, setRemoveAspectRatio] = useState<ImageAspectRatioValue>(DEFAULT_IMAGE_ASPECT_RATIO);

  // TAB 2: REPLACE PRODUCT state
  const [replaceSceneBatch, setReplaceSceneBatch] = useState<ImportBatch | null>(null);
  const [replaceProductBatch, setReplaceProductBatch] = useState<ImportBatch | null>(null);
  const [replaceDesc, setReplaceDesc] = useState('');
  const [replaceRegions, setReplaceRegions] = useState<RegionMap>({});
  const [replaceAspectRatio, setReplaceAspectRatio] = useState<ImageAspectRatioValue>(DEFAULT_IMAGE_ASPECT_RATIO);
  const [replaceModel, setReplaceModel] = useState<ReplaceProductModelSelection>(REPLACE_PRODUCT_MODEL_DEFAULT);

  // TAB 3: REPLACE LOGO state
  const [logoSourceBatch, setLogoSourceBatch] = useState<ImportBatch | null>(null);
  const [logoTargetBatch, setLogoTargetBatch] = useState<ImportBatch | null>(null);
  const [logoDesc, setLogoDesc] = useState('');
  const [logoText, setLogoText] = useState('');
  const [logoRegions, setLogoRegions] = useState<RegionMap>({});
  const [logoAspectRatio, setLogoAspectRatio] = useState<ImageAspectRatioValue>(DEFAULT_IMAGE_ASPECT_RATIO);

  // TAB 4: THEME VARIATION state
  const [themeRefBatch, setThemeRefBatch] = useState<ImportBatch | null>(null);
  const [themePrompt, setThemePrompt] = useState('');
  const [themeSellingPoints, setThemeSellingPoints] = useState('');
  const [themeColorScheme, setThemeColorScheme] = useState('');
  const [themeAspectRatio, setThemeAspectRatio] = useState<ImageAspectRatioValue>(DEFAULT_IMAGE_ASPECT_RATIO);
  const [themeShowProduct, setThemeShowProduct] = useState(true);
  const [themeCount, setThemeCount] = useState<number>(1);

  // TAB 5: SCENE VARIATION state
  const [sceneVariationBatch, setSceneVariationBatch] = useState<ImportBatch | null>(null);
  const [sceneVariationPrompt, setSceneVariationPrompt] = useState('');
  const [sceneVariationCategory, setSceneVariationCategory] = useState('');
  const [sceneVariationSellingPoints, setSceneVariationSellingPoints] = useState('');
  const [sceneVariationColorScheme, setSceneVariationColorScheme] = useState('');
  const [sceneVariationShowProduct, setSceneVariationShowProduct] = useState(false);
  const [sceneVariationAspectRatio, setSceneVariationAspectRatio] = useState<ImageAspectRatioValue>(DEFAULT_IMAGE_ASPECT_RATIO);
  const [sceneVariationCount, setSceneVariationCount] = useState<number>(1);

  // TAB 6: CREATE NEW SCENE state
  const [sceneDesc, setSceneDesc] = useState('');
  const [sceneProductCategory, setSceneProductCategory] = useState('');
  const [sceneSellingPoints, setSceneSellingPoints] = useState('');
  const [sceneColorScheme, setSceneColorScheme] = useState('');
  const [sceneShowProduct, setSceneShowProduct] = useState(true);
  const [sceneAspectRatio, setSceneAspectRatio] = useState<ImageAspectRatioValue>(DEFAULT_IMAGE_ASPECT_RATIO);
  const [sceneRefBatch, setSceneRefBatch] = useState<ImportBatch | null>(null);
  const [sceneCount, setSceneCount] = useState<number>(1);

  // TAB 7: PROMPT-ONLY MAIN ASSET state
  const [promptAssetBatch, setPromptAssetBatch] = useState<ImportBatch | null>(null);
  const [promptAssetPrompt, setPromptAssetPrompt] = useState('');
  const [promptAssetProductName, setPromptAssetProductName] = useState('');
  const [promptAssetSellingPoints, setPromptAssetSellingPoints] = useState('');
  const [promptAssetColorScheme, setPromptAssetColorScheme] = useState('');
  const [promptAssetAspectRatio, setPromptAssetAspectRatio] = useState<ImageAspectRatioValue>(DEFAULT_IMAGE_ASPECT_RATIO);
  const [promptAssetCount, setPromptAssetCount] = useState<number>(1);

  useEffect(() => {
    if (!restoredTask?.request?.feature) {
      return;
    }

    const route = getFeatureRoute(restoredTask.request.feature);
    if (route.tab !== 'product') {
      return;
    }

    const restored = applyProductRestore(restoredTask);
    if (!restored) {
      return;
    }

    setSubTab(restored.subTab);
    setRemoveBatch(restored.removeBatch);
    setRemoveDesc(restored.removeDesc);
    setRemoveRegions(restored.removeRegions);
    setRemoveAspectRatio(restored.removeAspectRatio);
    setReplaceSceneBatch(restored.replaceSceneBatch);
    setReplaceProductBatch(restored.replaceProductBatch);
    setReplaceDesc(restored.replaceDesc);
    setReplaceRegions(restored.replaceRegions);
    setReplaceAspectRatio(restored.replaceAspectRatio);
    setReplaceModel(restored.replaceModel);
    setLogoSourceBatch(restored.logoSourceBatch);
    setLogoTargetBatch(restored.logoTargetBatch);
    setLogoDesc(restored.logoDesc);
    setLogoText(restored.logoText);
    setLogoRegions(restored.logoRegions);
    setLogoAspectRatio(restored.logoAspectRatio);
    setThemeRefBatch(restored.themeRefBatch);
    setThemePrompt(restored.themePrompt);
    setThemeSellingPoints(restored.themeSellingPoints);
    setThemeColorScheme(restored.themeColorScheme);
    setThemeAspectRatio(restored.themeAspectRatio);
    setThemeShowProduct(restored.themeShowProduct);
    setThemeCount(restored.themeCount);
    setSceneVariationBatch(restored.sceneVariationBatch);
    setSceneVariationPrompt(restored.sceneVariationPrompt);
    setSceneVariationCategory(restored.sceneVariationCategory);
    setSceneVariationSellingPoints(restored.sceneVariationSellingPoints);
    setSceneVariationColorScheme(restored.sceneVariationColorScheme);
    setSceneVariationShowProduct(restored.sceneVariationShowProduct);
    setSceneVariationAspectRatio(restored.sceneVariationAspectRatio);
    setSceneVariationCount(restored.sceneVariationCount);
    setSceneDesc(restored.sceneDesc);
    setSceneProductCategory(restored.sceneProductCategory);
    setSceneSellingPoints(restored.sceneSellingPoints);
    setSceneColorScheme(restored.sceneColorScheme);
    setSceneShowProduct(restored.sceneShowProduct);
    setSceneAspectRatio(restored.sceneAspectRatio);
    setSceneRefBatch(restored.sceneRefBatch);
    setSceneCount(restored.sceneCount);
    setPromptAssetBatch(restored.promptAssetBatch);
    setPromptAssetPrompt(restored.promptAssetPrompt);
    setPromptAssetProductName(restored.promptAssetProductName);
    setPromptAssetSellingPoints(restored.promptAssetSellingPoints);
    setPromptAssetColorScheme(restored.promptAssetColorScheme);
    setPromptAssetAspectRatio(restored.promptAssetAspectRatio);
    setPromptAssetCount(restored.promptAssetCount);

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

  const activeExpectedCount = subTab === 'remove'
    ? (removeBatch?.images.length ?? 0)
    : subTab === 'replace'
      ? (replaceSceneBatch?.images.length ?? 0)
      : subTab === 'logo'
        ? (logoSourceBatch?.images.length ?? 0)
        : subTab === 'theme'
          ? (themeRefBatch?.images.length ?? 0) * themeCount
          : subTab === 'sceneVariation'
            ? (sceneVariationBatch?.images.length ?? 0) * sceneVariationCount
            : subTab === 'scene'
              ? sceneCount
              : promptAssetCount;
  const activeProgress = getTaskBatchProgress(activeTasks, activeExpectedCount);
  const showTaskResults = hasPartialOrCompleteBatchResults(activeTasks);
  const taskInProgress = isTaskBatchInProgress(activeTasks);
  const activeResultItems = activeTasks.flatMap((task) => task.images.map((imageUrl, index) => ({
    id: `${task.taskId}-${index}`,
    imageUrl,
    taskId: task.taskId,
    badge: 'Completed',
  })));
  const taskLogs = useMemo(
    () => filterLogsForTasks(logs, activeTasks),
    [logs, activeTasks],
  );
  const runProcessing = async (type: ProductSubTab) => {
    if (type === 'remove' && !removeBatch) {
      alert('请添加需要待去除的产品原图！');
      return;
    }
    if (type === 'replace' && (!replaceSceneBatch || !replaceProductBatch)) {
      alert('请同时上传原场景背景图和目标产品图！');
      return;
    }
    if (type === 'logo' && (!logoSourceBatch || !logoTargetBatch)) {
      alert('请先上传原图和透明背书新Logo！');
      return;
    }
    if (type === 'theme' && !themeRefBatch) {
      alert('请上传主图参考图以开始裂变');
      return;
    }
    if (type === 'sceneVariation' && !sceneVariationBatch) {
      alert('请上传场景参考图');
      return;
    }
    if (type === 'scene' && !sceneDesc && !sceneProductCategory) {
      alert('请输入产品品类或场景描述');
      return;
    }
    if (type === 'promptAsset' && !promptAssetPrompt.trim()) {
      alert('请输入主图/素材描述');
      return;
    }

    const sellingPointsFrom = (value: string) => (
      value.trim() ? value.split(/[,，]/).map((item) => item.trim()).filter(Boolean) : undefined
    );

    const requests: ImageTaskRequest[] = [];

    if (type === 'remove' && removeBatch) {
      for (const source of removeBatch.images) {
        requests.push({
          feature: FEATURE_MAP[type],
          images: [{ role: 'source', path: source.filePath }],
          count: 1,
          prompt: removeDesc || undefined,
          regions: regionsFromMap(removeRegions, source.filePath),
          aspectRatio: removeAspectRatio,
        });
      }
    } else if (type === 'replace' && replaceSceneBatch && replaceProductBatch) {
      const productPath = replaceProductBatch.images[0].filePath;
      const modelOverrides = resolveReplaceProductModelOverrides(replaceModel);
      for (const scene of replaceSceneBatch.images) {
        requests.push({
          feature: FEATURE_MAP[type],
          images: [
            { role: 'source', path: scene.filePath },
            { role: 'product', path: productPath },
          ],
          count: 1,
          prompt: replaceDesc || undefined,
          regions: regionsFromMap(replaceRegions, scene.filePath),
          aspectRatio: replaceAspectRatio,
          ...(modelOverrides ? { modelOverrides } : {}),
        });
      }
    } else if (type === 'logo' && logoSourceBatch && logoTargetBatch) {
      const logoPath = logoTargetBatch.images[0].filePath;
      for (const source of logoSourceBatch.images) {
        requests.push({
          feature: FEATURE_MAP[type],
          images: [
            { role: 'source', path: source.filePath },
            { role: 'logo', path: logoPath },
          ],
          count: 1,
          prompt: logoDesc || undefined,
          logoText: logoText || undefined,
          regions: regionsFromMap(logoRegions, source.filePath),
          aspectRatio: logoAspectRatio,
        });
      }
    } else if (type === 'theme' && themeRefBatch) {
      for (const source of themeRefBatch.images) {
        for (let index = 0; index < themeCount; index += 1) {
          requests.push({
            feature: FEATURE_MAP[type],
            images: [{ role: 'source', path: source.filePath }],
            count: 1,
            prompt: themePrompt || undefined,
            sellingPoints: sellingPointsFrom(themeSellingPoints),
            colorScheme: themeColorScheme || undefined,
            aspectRatio: themeAspectRatio,
            showProduct: themeShowProduct,
          });
        }
      }
    } else if (type === 'sceneVariation' && sceneVariationBatch) {
      for (const source of sceneVariationBatch.images) {
        for (let index = 0; index < sceneVariationCount; index += 1) {
          requests.push({
            feature: FEATURE_MAP[type],
            images: [{ role: 'source', path: source.filePath }],
            count: 1,
            prompt: sceneVariationPrompt || undefined,
            productCategory: sceneVariationCategory || undefined,
            sellingPoints: sellingPointsFrom(sceneVariationSellingPoints),
            colorScheme: sceneVariationColorScheme || undefined,
            showProduct: sceneVariationShowProduct,
            aspectRatio: sceneVariationAspectRatio,
          });
        }
      }
    } else if (type === 'scene') {
      const styleImages = sceneRefBatch?.images ?? [];
      for (let index = 0; index < sceneCount; index += 1) {
        const styleImage = styleImages.length > 0 ? styleImages[index % styleImages.length] : undefined;
        requests.push({
          feature: FEATURE_MAP[type],
          images: styleImage ? [{ role: 'style', path: styleImage.filePath }] : [],
          count: 1,
          prompt: sceneDesc || undefined,
          productCategory: sceneProductCategory || undefined,
          sellingPoints: sellingPointsFrom(sceneSellingPoints),
          colorScheme: sceneColorScheme || undefined,
          aspectRatio: sceneAspectRatio,
          showProduct: sceneShowProduct,
        });
      }
    } else if (type === 'promptAsset') {
      const referenceImages = promptAssetBatch?.images ?? [];
      for (let index = 0; index < promptAssetCount; index += 1) {
        requests.push({
          feature: FEATURE_MAP[type],
          images: referenceImages.map((image, imageIndex) => ({
            role: imageIndex === 0 ? 'reference' as const : 'style' as const,
            path: image.filePath,
          })),
          count: 1,
          prompt: `生成电商主图或广告素材：${promptAssetPrompt.trim()}`,
          productName: promptAssetProductName || undefined,
          sellingPoints: sellingPointsFrom(promptAssetSellingPoints),
          colorScheme: promptAssetColorScheme || undefined,
          aspectRatio: promptAssetAspectRatio,
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
    <div className="ui-page" id="product-processing-tab-content">
      
      {/* Product Processing Top Sub-Tabs (Pictured in exactly 5 states across Wireframes) */}
      <div className="ui-subtab-bar" id="product-sub-tabs">
        <button 
          id="product-subtab-remove"
          onClick={() => { setSubTab('remove'); }}
          className={subTab === 'remove' ? 'ui-subtab-active' : 'ui-subtab'}
        >
          去除产品
          {subTab === 'remove' && <div className="ui-subtab-indicator" />}
        </button>
        <button 
          id="product-subtab-replace"
          onClick={() => { setSubTab('replace'); }}
          className={subTab === 'replace' ? 'ui-subtab-active' : 'ui-subtab'}
        >
          替换产品
          {subTab === 'replace' && <div className="ui-subtab-indicator" />}
        </button>
        <button 
          id="product-subtab-logo"
          onClick={() => { setSubTab('logo'); }}
          className={subTab === 'logo' ? 'ui-subtab-active' : 'ui-subtab'}
        >
          替换Logo
          {subTab === 'logo' && <div className="ui-subtab-indicator" />}
        </button>
        <button 
          id="product-subtab-theme"
          onClick={() => { setSubTab('theme'); }}
          className={subTab === 'theme' ? 'ui-subtab-active' : 'ui-subtab'}
        >
          主图裂变
          {subTab === 'theme' && <div className="ui-subtab-indicator" />}
        </button>
        <button 
          id="product-subtab-scene-variation"
          onClick={() => { setSubTab('sceneVariation'); }}
          className={subTab === 'sceneVariation' ? 'ui-subtab-active' : 'ui-subtab'}
        >
          场景裂变
          {subTab === 'sceneVariation' && <div className="ui-subtab-indicator" />}
        </button>
        <button 
          id="product-subtab-scene"
          onClick={() => { setSubTab('scene'); }}
          className={subTab === 'scene' ? 'ui-subtab-active' : 'ui-subtab'}
        >
          创作新场景
          {subTab === 'scene' && <div className="ui-subtab-indicator" />}
        </button>
        <button 
          id="product-subtab-prompt-asset"
          onClick={() => { setSubTab('promptAsset'); }}
          className={subTab === 'promptAsset' ? 'ui-subtab-active' : 'ui-subtab'}
        >
          纯提示词主图
          {subTab === 'promptAsset' && <div className="ui-subtab-indicator" />}
        </button>
      </div>

      <FeatureWorkspaceLayout
        submitId={`submit-product-${subTab}`}
        onSubmit={() => runProcessing(subTab)}
        isSubmitting={isSubmitting}
        progressLabel={formatTaskBatchProgress(activeTasks, activeExpectedCount)}
        taskInProgress={taskInProgress}
        onOpenDirectory={handleOpenOutputDirectory}
        showOpenDirectory={showTaskResults}
        drawerOpen={isTaskDrawerOpen}
        onDrawerOpenChange={setIsTaskDrawerOpen}
        parameters={(
          <>
            {subTab === 'remove' && (
              <FeatureParameterPanels
                reference={(
                  <>
                    <ImageUploader
                      batch={removeBatch}
                      onBatchChange={(batch) => {
                        setRemoveBatch(batch);
                        syncBatchRegions(batch, removeRegions, setRemoveRegions);
                      }}
                      page="product"
                      feature="remove"
                      label="待处理原图"
                    />
                    {removeBatch && removeBatch.images.length > 0 && (
                      <BatchRegionSelector
                        images={removeBatch.images.map((image) => ({
                          path: image.filePath,
                          label: image.fileName,
                        }))}
                        imageRole="source"
                        regions={removeRegions}
                        onRegionsChange={setRemoveRegions}
                        operationHint="remove target product and reconstruct background"
                      />
                    )}
                  </>
                )}
                basic={(
                  <AspectRatioSelect
                    id="remove-aspect-ratio-select"
                    value={removeAspectRatio}
                    onChange={setRemoveAspectRatio}
                    label="图片比例"
                  />
                )}
                advanced={(
                  <div className="space-y-2 sm:col-span-2">
                    <label className="ui-label">去除说明</label>
                    <textarea
                      value={removeDesc}
                      onChange={(e) => setRemoveDesc(e.target.value)}
                      placeholder="例如：去掉栏杆上的雾气/液滴叠加，保留锈蚀前后对比和顶部文字"
                      className="ui-textarea h-16 text-xs"
                    />
                  </div>
                )}
              />
            )}

            {subTab === 'replace' && (
              <FeatureParameterPanels
                reference={(
                  <>
                    <div className={REFERENCE_UPLOAD_STACK}>
                      <ImageUploader
                        square
                        batch={replaceSceneBatch}
                        onBatchChange={(batch) => {
                          setReplaceSceneBatch(batch);
                          syncBatchRegions(batch, replaceRegions, setReplaceRegions);
                        }}
                        page="product"
                        feature="replaceScene"
                        label="原场景"
                      />
                      <ImageUploader
                        square
                        batch={replaceProductBatch}
                        onBatchChange={setReplaceProductBatch}
                        page="product"
                        feature="replaceProduct"
                        label="目标产品"
                      />
                    </div>
                    {replaceSceneBatch && replaceSceneBatch.images.length > 0 && (
                      <BatchRegionSelector
                        images={replaceSceneBatch.images.map((image) => ({
                          path: image.filePath,
                          label: image.fileName,
                        }))}
                        imageRole="source"
                        regions={replaceRegions}
                        onRegionsChange={setReplaceRegions}
                        operationHint="replace this product"
                      />
                    )}
                  </>
                )}
                basic={(
                  <>
                    <AspectRatioSelect
                      id="replace-aspect-ratio-select"
                      value={replaceAspectRatio}
                      onChange={setReplaceAspectRatio}
                      label="图片比例"
                    />
                    <ReplaceProductModelSelect
                      id="replace-model-select"
                      value={replaceModel}
                      onChange={setReplaceModel}
                    />
                  </>
                )}
                advanced={(
                  <div className="space-y-2 sm:col-span-2">
                    <label className="ui-label">替换说明</label>
                    <textarea
                      value={replaceDesc}
                      onChange={(e) => setReplaceDesc(e.target.value)}
                      placeholder="例如：放在原瓶子位置，保持厨房台面光影"
                      className="ui-textarea h-16 text-xs"
                    />
                  </div>
                )}
              />
            )}

            {subTab === 'logo' && (
              <FeatureParameterPanels
                reference={(
                  <>
                    <div className={REFERENCE_UPLOAD_STACK}>
                      <ImageUploader
                        square
                        batch={logoSourceBatch}
                        onBatchChange={(batch) => {
                          setLogoSourceBatch(batch);
                          syncBatchRegions(batch, logoRegions, setLogoRegions);
                        }}
                        page="product"
                        feature="logoSource"
                        label="原图"
                      />
                      <ImageUploader
                        square
                        batch={logoTargetBatch}
                        onBatchChange={setLogoTargetBatch}
                        page="product"
                        feature="logoTarget"
                        label="目标 Logo"
                        placeholder="上传透明背景 PNG"
                      />
                    </div>
                    {logoSourceBatch && logoSourceBatch.images.length > 0 && (
                      <BatchRegionSelector
                        images={logoSourceBatch.images.map((image) => ({
                          path: image.filePath,
                          label: image.fileName,
                        }))}
                        imageRole="source"
                        regions={logoRegions}
                        onRegionsChange={setLogoRegions}
                        operationHint="replace only this brand logo"
                      />
                    )}
                  </>
                )}
                basic={(
                  <AspectRatioSelect
                    id="logo-aspect-ratio-select"
                    value={logoAspectRatio}
                    onChange={setLogoAspectRatio}
                    label="图片比例"
                  />
                )}
                advanced={(
                  <>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="ui-label">Logo 文字</label>
                      <input
                        type="text"
                        value={logoText}
                        onChange={(e) => setLogoText(e.target.value)}
                        placeholder="例如：品牌英文名"
                        className="ui-input-compact"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="ui-label">替换说明</label>
                      <textarea
                        value={logoDesc}
                        onChange={(e) => setLogoDesc(e.target.value)}
                        placeholder="例如：只替换左上角品牌标识，保持原有透视和光影"
                        className="ui-textarea h-16 text-xs"
                      />
                    </div>
                  </>
                )}
              />
            )}

            {subTab === 'theme' && (
              <FeatureParameterPanels
                reference={(
                  <ImageUploader
                    batch={themeRefBatch}
                    onBatchChange={setThemeRefBatch}
                    page="product"
                    feature="themeRef"
                    label="产品/主图参考图"
                  />
                )}
                basic={(
                  <>
                    <AspectRatioSelect
                      id="theme-aspect-ratio-select"
                      value={themeAspectRatio}
                      onChange={setThemeAspectRatio}
                      label="图片比例"
                    />
                    <ImageCountSelector
                      id="theme-count-selector"
                      value={themeCount}
                      onChange={setThemeCount}
                    />
                  </>
                )}
                advanced={(
                  <>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="ui-label">附加提示词</label>
                      <textarea
                        value={themePrompt}
                        onChange={(e) => setThemePrompt(e.target.value)}
                        placeholder="例如：鞋子除味喷雾，生成一套全英文电商主图，强调清新除味"
                        className="ui-textarea h-16 text-xs"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="ui-label">卖点</label>
                      <input
                        type="text"
                        value={themeSellingPoints}
                        onChange={(e) => setThemeSellingPoints(e.target.value)}
                        placeholder="例如：Easy to pack, Fresh scent, Ready when needed"
                        className="ui-input-compact"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="ui-label">色系</label>
                      <input
                        type="text"
                        value={themeColorScheme}
                        onChange={(e) => setThemeColorScheme(e.target.value)}
                        placeholder="例如：蓝白色调"
                        className="ui-input-compact"
                      />
                    </div>
                    <ShowProductToggle value={themeShowProduct} onChange={setThemeShowProduct} />
                  </>
                )}
              />
            )}

            {subTab === 'sceneVariation' && (
              <FeatureParameterPanels
                reference={(
                  <ImageUploader
                    batch={sceneVariationBatch}
                    onBatchChange={setSceneVariationBatch}
                    page="product"
                    feature="sceneVariationRef"
                    label="场景参考图"
                  />
                )}
                basic={(
                  <>
                    <AspectRatioSelect
                      id="scene-variation-aspect-ratio-select"
                      value={sceneVariationAspectRatio}
                      onChange={setSceneVariationAspectRatio}
                      label="图片比例"
                    />
                    <ImageCountSelector
                      id="scene-variation-count-selector"
                      value={sceneVariationCount}
                      onChange={setSceneVariationCount}
                    />
                  </>
                )}
                advanced={(
                  <>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="ui-label">附加提示词</label>
                      <textarea
                        value={sceneVariationPrompt}
                        onChange={(e) => setSceneVariationPrompt(e.target.value)}
                        placeholder="例如：厨房水槽、灶台、锅底三个方向，不展示具体产品"
                        className="ui-textarea h-16 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="ui-label">产品品类</label>
                      <input
                        type="text"
                        value={sceneVariationCategory}
                        onChange={(e) => setSceneVariationCategory(e.target.value)}
                        placeholder="例如：清洁产品"
                        className="ui-input-compact"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="ui-label">卖点</label>
                      <input
                        type="text"
                        value={sceneVariationSellingPoints}
                        onChange={(e) => setSceneVariationSellingPoints(e.target.value)}
                        placeholder="例如：厨房清洁，可用逗号分隔"
                        className="ui-input-compact"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="ui-label">色系</label>
                      <input
                        type="text"
                        value={sceneVariationColorScheme}
                        onChange={(e) => setSceneVariationColorScheme(e.target.value)}
                        placeholder="例如：明亮自然光"
                        className="ui-input-compact"
                      />
                    </div>
                    <ShowProductToggle value={sceneVariationShowProduct} onChange={setSceneVariationShowProduct} />
                  </>
                )}
              />
            )}

            {subTab === 'scene' && (
              <FeatureParameterPanels
                reference={(
                  <ImageUploader
                    batch={sceneRefBatch}
                    onBatchChange={setSceneRefBatch}
                    page="product"
                    feature="sceneRef"
                    label="风格参考图"
                    placeholder="点击、拖拽或粘贴上传"
                    optional
                  />
                )}
                basic={(
                  <>
                    <AspectRatioSelect
                      id="scene-aspect-ratio-select"
                      value={sceneAspectRatio}
                      onChange={setSceneAspectRatio}
                      label="图片比例"
                    />
                    <ImageCountSelector
                      id="scene-count-selector"
                      value={sceneCount}
                      onChange={setSceneCount}
                    />
                  </>
                )}
                advanced={(
                  <>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="ui-label">
                        场景描述 <span className="text-red-500 font-bold">*</span>
                      </label>
                      <textarea
                        value={sceneDesc}
                        onChange={(e) => setSceneDesc(e.target.value)}
                        placeholder="例如：清洁片在现代厨房使用，明亮自然光，突出泡腾清洁感"
                        className="ui-textarea h-16 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="ui-label">产品品类</label>
                      <input
                        type="text"
                        value={sceneProductCategory}
                        onChange={(e) => setSceneProductCategory(e.target.value)}
                        placeholder="例如：清洁片"
                        className="ui-input-compact"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="ui-label">卖点</label>
                      <input
                        type="text"
                        value={sceneSellingPoints}
                        onChange={(e) => setSceneSellingPoints(e.target.value)}
                        placeholder="例如：泡腾清洁，厨房清洁"
                        className="ui-input-compact"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="ui-label">色系</label>
                      <input
                        type="text"
                        value={sceneColorScheme}
                        onChange={(e) => setSceneColorScheme(e.target.value)}
                        placeholder="例如：明亮自然光"
                        className="ui-input-compact"
                      />
                    </div>
                    <ShowProductToggle value={sceneShowProduct} onChange={setSceneShowProduct} />
                  </>
                )}
              />
            )}

            {subTab === 'promptAsset' && (
              <FeatureParameterPanels
                reference={(
                  <ImageUploader
                    batch={promptAssetBatch}
                    onBatchChange={setPromptAssetBatch}
                    page="product"
                    feature="promptAssetRef"
                    label="风格/参考图"
                    optional
                  />
                )}
                basic={(
                  <>
                    <AspectRatioSelect
                      id="prompt-asset-aspect-ratio-select"
                      value={promptAssetAspectRatio}
                      onChange={setPromptAssetAspectRatio}
                      label="图片比例"
                    />
                    <ImageCountSelector
                      id="prompt-asset-count-selector"
                      value={promptAssetCount}
                      onChange={setPromptAssetCount}
                    />
                  </>
                )}
                advanced={(
                  <>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="ui-label">
                        主图/素材描述 <span className="text-red-500 font-bold">*</span>
                      </label>
                      <textarea
                        value={promptAssetPrompt}
                        onChange={(e) => setPromptAssetPrompt(e.target.value)}
                        placeholder="例如：生成一张洗衣清洁片广告素材，粉色背景，泡泡、水流、清新感"
                        className="ui-textarea h-20 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="ui-label">产品名称</label>
                      <input
                        type="text"
                        value={promptAssetProductName}
                        onChange={(e) => setPromptAssetProductName(e.target.value)}
                        placeholder="例如：Laundry Cleaning Sheets"
                        className="ui-input-compact"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="ui-label">卖点</label>
                      <input
                        type="text"
                        value={promptAssetSellingPoints}
                        onChange={(e) => setPromptAssetSellingPoints(e.target.value)}
                        placeholder="例如：深层清洁，可用逗号分隔"
                        className="ui-input-compact"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="ui-label">色系</label>
                      <input
                        type="text"
                        value={promptAssetColorScheme}
                        onChange={(e) => setPromptAssetColorScheme(e.target.value)}
                        placeholder="例如：粉色背景"
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
          <div className="space-y-4" id="product-workspace-preview">
            <GenerationTaskStatus
              tasks={activeTasks}
              fallbackCount={activeExpectedCount}
              error={error}
              logs={taskLogs}
              isLoadingLogs={isLoadingLogs}
            />

            {(showTaskResults || taskInProgress) && (
              <GenerationResult
                mode={activeExpectedCount <= 1 ? 'single' : 'multi'}
                state={taskInProgress ? 'running' : 'completed'}
                results={activeResultItems}
                placeholders={activeProgress.total}
                count={activeProgress.total}
                showCount
                progressLabel={formatTaskBatchProgress(activeTasks, activeExpectedCount)}
                onOpenDirectory={() => handleOpenOutputDirectory()}
                onOpenDirectoryAll={handleOpenOutputDirectory}
                onCopyImage={(item) => handleCopyGeneratedImage(item.imageUrl)}
              />
            )}
          </div>
        )}
      />
    </div>
  );
}

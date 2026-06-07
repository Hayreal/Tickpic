import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type { ProductSubTab } from '../shared/view/ui';
import type { ImportBatch } from '../shared/domain/images';
import { useImageTask } from '../hooks/useImageTask';
import { useOpenOutputDirectory } from '../hooks/useOpenOutputDirectory';
import type { ImageTaskRequest, ImageFeature, RegionInput } from '../shared/domain/imageFeatureApi';
import ImageUploader from './ImageUploader';
import RegionSelector from './RegionSelector';
import { UI } from '../shared/view/design';
import GenerationResult from './GenerationResult';
import AspectRatioSelect, { DEFAULT_IMAGE_ASPECT_RATIO } from './AspectRatioSelect';
import type { ImageAspectRatioValue } from '../shared/view/imageAspectRatioOptions';
import type { TaskRecord } from '../shared/domain/tasks';
import { getFeatureRoute } from '../shared/view/featureRoutes';
import { applyProductRestore } from '../features/tasks/applyProductRestore';
import {
  formatTaskProgress,
  getTaskProgress,
  hasPartialOrCompleteResults,
  isTaskInProgress,
} from '../features/tasks/taskProgress';
import { imageTaskRecordFromTaskRecord } from '../features/tasks/taskRestoreHelpers';
import { useDesktopClient } from '../hooks/useDesktopClient';

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

function regionsFrom(region: RegionInput | null | undefined) {
  return region ? [region] : undefined;
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
  const desktopClient = useDesktopClient();
  const { submit, bindTask, restoreTask, getTask, getError, isSubmitting } = useImageTask();
  const currentFeature = FEATURE_MAP[subTab];
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

  // TAB 1: REMOVE PRODUCT state
  const [removeBatch, setRemoveBatch] = useState<ImportBatch | null>(null);
  const [removeDesc, setRemoveDesc] = useState('');
  const [removeRegion, setRemoveRegion] = useState<RegionInput | null>(null);
  const [removeAspectRatio, setRemoveAspectRatio] = useState<ImageAspectRatioValue>(DEFAULT_IMAGE_ASPECT_RATIO);

  // TAB 2: REPLACE PRODUCT state
  const [replaceSceneBatch, setReplaceSceneBatch] = useState<ImportBatch | null>(null);
  const [replaceProductBatch, setReplaceProductBatch] = useState<ImportBatch | null>(null);
  const [replaceDesc, setReplaceDesc] = useState('');
  const [replaceRegion, setReplaceRegion] = useState<RegionInput | null>(null);
  const [replaceAspectRatio, setReplaceAspectRatio] = useState<ImageAspectRatioValue>(DEFAULT_IMAGE_ASPECT_RATIO);

  // TAB 3: REPLACE LOGO state
  const [logoSourceBatch, setLogoSourceBatch] = useState<ImportBatch | null>(null);
  const [logoTargetBatch, setLogoTargetBatch] = useState<ImportBatch | null>(null);
  const [logoDesc, setLogoDesc] = useState('');
  const [logoText, setLogoText] = useState('');
  const [logoRegion, setLogoRegion] = useState<RegionInput | null>(null);
  const [logoAspectRatio, setLogoAspectRatio] = useState<ImageAspectRatioValue>(DEFAULT_IMAGE_ASPECT_RATIO);

  // TAB 4: THEME VARIATION state
  const [themeRefBatch, setThemeRefBatch] = useState<ImportBatch | null>(null);
  const [themePrompt, setThemePrompt] = useState('');
  const [themeSellingPoints, setThemeSellingPoints] = useState('');
  const [themeColorScheme, setThemeColorScheme] = useState('');
  const [themeAspectRatio, setThemeAspectRatio] = useState<ImageAspectRatioValue>(DEFAULT_IMAGE_ASPECT_RATIO);
  const [themeShowProduct, setThemeShowProduct] = useState(false);
  const [themeCount, setThemeCount] = useState<number>(4);

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
  const [sceneCount, setSceneCount] = useState<number>(4);

  // TAB 7: PROMPT-ONLY MAIN ASSET state
  const [promptAssetBatch, setPromptAssetBatch] = useState<ImportBatch | null>(null);
  const [promptAssetPrompt, setPromptAssetPrompt] = useState('');
  const [promptAssetProductName, setPromptAssetProductName] = useState('');
  const [promptAssetSellingPoints, setPromptAssetSellingPoints] = useState('');
  const [promptAssetColorScheme, setPromptAssetColorScheme] = useState('');
  const [promptAssetAspectRatio, setPromptAssetAspectRatio] = useState<ImageAspectRatioValue>(DEFAULT_IMAGE_ASPECT_RATIO);
  const [promptAssetCount, setPromptAssetCount] = useState<number>(4);

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
    setRemoveRegion(restored.removeRegion);
    setRemoveAspectRatio(restored.removeAspectRatio);
    setReplaceSceneBatch(restored.replaceSceneBatch);
    setReplaceProductBatch(restored.replaceProductBatch);
    setReplaceDesc(restored.replaceDesc);
    setReplaceRegion(restored.replaceRegion);
    setReplaceAspectRatio(restored.replaceAspectRatio);
    setLogoSourceBatch(restored.logoSourceBatch);
    setLogoTargetBatch(restored.logoTargetBatch);
    setLogoDesc(restored.logoDesc);
    setLogoText(restored.logoText);
    setLogoRegion(restored.logoRegion);
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

  const showTaskResults = hasPartialOrCompleteResults(activeTask);
  const taskInProgress = isTaskInProgress(activeTask);
  const activeCount = subTab === 'theme'
    ? themeCount
    : subTab === 'sceneVariation'
      ? sceneVariationCount
      : subTab === 'scene'
        ? sceneCount
        : subTab === 'promptAsset'
          ? promptAssetCount
          : 1;
  const activeProgress = getTaskProgress(activeTask, activeCount);

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

    const images: ImageTaskRequest['images'] = [];

    if (type === 'remove' && removeBatch) {
      images.push({ role: 'source', path: removeBatch.images[0].filePath });
    } else if (type === 'replace') {
      if (replaceSceneBatch) images.push({ role: 'source', path: replaceSceneBatch.images[0].filePath });
      if (replaceProductBatch) images.push({ role: 'product', path: replaceProductBatch.images[0].filePath });
    } else if (type === 'logo') {
      if (logoSourceBatch) images.push({ role: 'source', path: logoSourceBatch.images[0].filePath });
      if (logoTargetBatch) images.push({ role: 'logo', path: logoTargetBatch.images[0].filePath });
    } else if (type === 'theme' && themeRefBatch) {
      images.push({ role: 'source', path: themeRefBatch.images[0].filePath });
    } else if (type === 'sceneVariation' && sceneVariationBatch) {
      images.push({ role: 'source', path: sceneVariationBatch.images[0].filePath });
    } else if (type === 'scene' && sceneRefBatch) {
      images.push({ role: 'style', path: sceneRefBatch.images[0].filePath });
    } else if (type === 'promptAsset' && promptAssetBatch) {
      promptAssetBatch.images.forEach((image, index) => {
        images.push({
          role: index === 0 ? 'reference' : 'style',
          path: image.filePath,
        });
      });
    }

    const sellingPointsFrom = (value: string) => (
      value.trim() ? value.split(/[,，]/).map((item) => item.trim()).filter(Boolean) : undefined
    );

    const request: ImageTaskRequest = {
      feature: FEATURE_MAP[type],
      images,
      count:
        type === 'theme' ? themeCount
          : type === 'sceneVariation' ? sceneVariationCount
            : type === 'scene' ? sceneCount
              : type === 'promptAsset' ? promptAssetCount
                : 1,
      ...(type === 'remove' && {
        prompt: removeDesc || undefined,
        regions: regionsFrom(removeRegion),
        aspectRatio: removeAspectRatio,
      }),
      ...(type === 'replace' && {
        prompt: replaceDesc || undefined,
        regions: regionsFrom(replaceRegion),
        aspectRatio: replaceAspectRatio,
      }),
      ...(type === 'logo' && {
        prompt: logoDesc || undefined,
        logoText: logoText || undefined,
        regions: regionsFrom(logoRegion),
        aspectRatio: logoAspectRatio,
      }),
      ...(type === 'theme' && {
        prompt: themePrompt || undefined,
        sellingPoints: sellingPointsFrom(themeSellingPoints),
        colorScheme: themeColorScheme || undefined,
        aspectRatio: themeAspectRatio,
        showProduct: themeShowProduct,
      }),
      ...(type === 'sceneVariation' && {
        prompt: sceneVariationPrompt || undefined,
        productCategory: sceneVariationCategory || undefined,
        sellingPoints: sellingPointsFrom(sceneVariationSellingPoints),
        colorScheme: sceneVariationColorScheme || undefined,
        showProduct: sceneVariationShowProduct,
        aspectRatio: sceneVariationAspectRatio,
      }),
      ...(type === 'scene' && {
        prompt: sceneDesc || undefined,
        productCategory: sceneProductCategory || undefined,
        sellingPoints: sellingPointsFrom(sceneSellingPoints),
        colorScheme: sceneColorScheme || undefined,
        aspectRatio: sceneAspectRatio,
        showProduct: sceneShowProduct,
      }),
      ...(type === 'promptAsset' && {
        prompt: `生成电商主图或广告素材：${promptAssetPrompt.trim()}`,
        productName: promptAssetProductName || undefined,
        sellingPoints: sellingPointsFrom(promptAssetSellingPoints),
        colorScheme: promptAssetColorScheme || undefined,
        aspectRatio: promptAssetAspectRatio,
      }),
    };

    try {
      await submit(request);
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

      {/* Split Inner Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Parameters Left Column */}
        <div className="ui-param-panel" id="product-parameters">
          
          <div className="space-y-6">

            {/* TAB 1: REMOVE PRODUCT (去除产品) */}
            {subTab === 'remove' && (
              <div className="space-y-5" id="parameter-product-remove">
                <div>
                  <p className="text-[10px] text-muted-foreground font-sans leading-none mb-1.5">原始产品放置背景图</p>
                  <ImageUploader
                    batch={removeBatch}
                    onBatchChange={(batch) => {
                      setRemoveBatch(batch);
                      if (!batch) setRemoveRegion(null);
                    }}
                    page="product"
                    feature="remove"
                    label="待处理原图"
                  />
                </div>

                {removeBatch?.images[0] && (
                  <RegionSelector
                    imagePath={removeBatch.images[0].filePath}
                    imageRole="source"
                    region={removeRegion}
                    onRegionChange={setRemoveRegion}
                    operationHint="remove target product and reconstruct background"
                  />
                )}


                {/* Free description instructions */}
                <div className="space-y-2">
                  <label className="ui-label">去除说明 (可选)</label>
                  <textarea 
                    value={removeDesc}
                    onChange={(e) => setRemoveDesc(e.target.value)}
                    placeholder="例如：移除背景中的杂物，保留主要阴影..."
                    className="w-full h-24 bg-white rounded-lg border border-border focus:border-primary focus:outline-none p-3 text-xs text-foreground placeholder:text-muted-foreground resize-none transition-colors"
                  />
                </div>

                <AspectRatioSelect
                  id="remove-aspect-ratio-select"
                  value={removeAspectRatio}
                  onChange={setRemoveAspectRatio}
                />
              </div>
            )}

            {/* TAB 2: REPLACE PRODUCT (替换产品) */}
            {subTab === 'replace' && (
              <div className="space-y-5" id="parameter-product-replace">
                <div className="grid grid-cols-2 gap-3">
                  <ImageUploader
                    batch={replaceSceneBatch}
                    onBatchChange={(batch) => {
                      setReplaceSceneBatch(batch);
                      if (!batch) setReplaceRegion(null);
                    }}
                    page="product"
                    feature="replaceScene"
                    label="原场景"
                    placeholder="更换场景"
                    description=""
                  />
                  <ImageUploader
                    batch={replaceProductBatch}
                    onBatchChange={setReplaceProductBatch}
                    page="product"
                    feature="replaceProduct"
                    label="目标产品"
                    placeholder="上传产品"
                    description=""
                  />
                </div>

                {replaceSceneBatch?.images[0] && (
                  <RegionSelector
                    imagePath={replaceSceneBatch.images[0].filePath}
                    imageRole="source"
                    region={replaceRegion}
                    onRegionChange={setReplaceRegion}
                    operationHint="replace this product"
                  />
                )}


                {/* instructions */}
                <div className="space-y-2">
                  <label className="ui-label">替换说明 (可选)</label>
                  <textarea 
                    value={replaceDesc}
                    onChange={(e) => setReplaceDesc(e.target.value)}
                    placeholder="例如：确保新产品完美贴合桌面。匹配温暖的晨光和玻璃上的微妙反光。"
                    className="w-full h-24 bg-white rounded-lg border border-border focus:border-primary focus:outline-none p-3 text-xs text-foreground placeholder:text-muted-foreground resize-none transition-colors"
                  />
                </div>

                <AspectRatioSelect
                  id="replace-aspect-ratio-select"
                  value={replaceAspectRatio}
                  onChange={setReplaceAspectRatio}
                />
              </div>
            )}
            {subTab === 'logo' && (
              <div className="space-y-5" id="parameter-product-logo">
                <div className="space-y-4">
                  <ImageUploader
                    batch={logoSourceBatch}
                    onBatchChange={(batch) => {
                      setLogoSourceBatch(batch);
                      if (!batch) setLogoRegion(null);
                    }}
                    page="product"
                    feature="logoSource"
                    label="原图 (Source Image)"
                    placeholder="点击或拖拽上传原图"
                    description=""
                  />
                  <ImageUploader
                    batch={logoTargetBatch}
                    onBatchChange={setLogoTargetBatch}
                    page="product"
                    feature="logoTarget"
                    label="目标 Logo (Target Logo)"
                    placeholder="上传需要替换的新 Logo (透明背景PNG)"
                    description=""
                  />
                </div>

                {logoSourceBatch?.images[0] && (
                  <RegionSelector
                    imagePath={logoSourceBatch.images[0].filePath}
                    imageRole="source"
                    region={logoRegion}
                    onRegionChange={setLogoRegion}
                    operationHint="replace only this brand logo"
                  />
                )}

                <div className="space-y-2">
                  <label className="ui-label">Logo 文字 (可选)</label>
                  <input
                    type="text"
                    value={logoText}
                    onChange={(e) => setLogoText(e.target.value)}
                    placeholder="例如：品牌英文名"
                    className="ui-input-compact"
                  />
                </div>


                {/* Instructions text */}
                <div className="space-y-2">
                  <label className="ui-label">替换说明 (Instructions - 可选)</label>
                  <textarea 
                    value={logoDesc}
                    onChange={(e) => setLogoDesc(e.target.value)}
                    placeholder="例如：只替换左上角品牌标识，保持原有透视和光影"
                    className="ui-textarea h-20 text-xs"
                  />
                </div>

                <AspectRatioSelect
                  id="logo-aspect-ratio-select"
                  value={logoAspectRatio}
                  onChange={setLogoAspectRatio}
                />
              </div>
            )}

            {/* TAB 4: THEME VARIATION (主图裂变) */}
            {subTab === 'theme' && (
              <div className="space-y-5" id="parameter-product-theme">
                <ImageUploader
                  batch={themeRefBatch}
                  onBatchChange={setThemeRefBatch}
                  page="product"
                  feature="themeRef"
                  label="主题/场景参考图"
                />

                {/* Theme Prompt */}
                <div className="space-y-2">
                  <label className="ui-label">附加提示词 (Prompt)</label>
                  <textarea 
                    value={themePrompt}
                    onChange={(e) => setThemePrompt(e.target.value)}
                    placeholder="例如：做 Before/After 对比，突出去污效果"
                    className="w-full h-24 bg-white rounded-lg border border-border focus:border-primary focus:outline-none p-3 text-xs text-foreground placeholder:text-muted-foreground resize-none transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="ui-label">卖点 (可选)</label>
                  <input
                    type="text"
                    value={themeSellingPoints}
                    onChange={(e) => setThemeSellingPoints(e.target.value)}
                    placeholder="例如：去污效果，可用逗号分隔"
                    className="ui-input-compact"
                  />
                </div>

                <div className="space-y-2">
                  <label className="ui-label">色系 (可选)</label>
                  <input
                    type="text"
                    value={themeColorScheme}
                    onChange={(e) => setThemeColorScheme(e.target.value)}
                    placeholder="例如：蓝白色调"
                    className="ui-input-compact"
                  />
                </div>

                <AspectRatioSelect
                  id="theme-aspect-ratio-select"
                  value={themeAspectRatio}
                  onChange={setThemeAspectRatio}
                />

                <ShowProductToggle value={themeShowProduct} onChange={setThemeShowProduct} />

                {/* Count Select */}
                <div className="space-y-2">
                  <label className="ui-label">生成数量</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[4, 8].map((num) => (
                      <button
                        key={num}
                        onClick={() => setThemeCount(num)}
                        className={`cursor-pointer py-2 rounded-lg text-xs font-bold transition-all border ${themeCount === num ? 'ui-segment-active' : 'ui-segment-inactive'}`}
                      >
                        {num}张
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: SCENE VARIATION (场景裂变) */}
            {subTab === 'sceneVariation' && (
              <div className="space-y-5" id="parameter-product-scene-variation">
                <ImageUploader
                  batch={sceneVariationBatch}
                  onBatchChange={setSceneVariationBatch}
                  page="product"
                  feature="sceneVariationRef"
                  label="场景参考图"
                />

                <div className="space-y-2">
                  <label className="ui-label">附加提示词 (可选)</label>
                  <textarea
                    value={sceneVariationPrompt}
                    onChange={(e) => setSceneVariationPrompt(e.target.value)}
                    placeholder="例如：厨房水槽、灶台、锅底三个方向，不展示具体产品"
                    className="w-full h-24 bg-white rounded-lg border border-border focus:border-primary focus:outline-none p-3 text-xs text-foreground placeholder:text-muted-foreground resize-none transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="ui-label">产品品类 (可选)</label>
                  <input
                    type="text"
                    value={sceneVariationCategory}
                    onChange={(e) => setSceneVariationCategory(e.target.value)}
                    placeholder="例如：清洁产品"
                    className="ui-input-compact"
                  />
                </div>

                <div className="space-y-2">
                  <label className="ui-label">卖点 (可选)</label>
                  <input
                    type="text"
                    value={sceneVariationSellingPoints}
                    onChange={(e) => setSceneVariationSellingPoints(e.target.value)}
                    placeholder="例如：厨房清洁，可用逗号分隔"
                    className="ui-input-compact"
                  />
                </div>

                <div className="space-y-2">
                  <label className="ui-label">色系 (可选)</label>
                  <input
                    type="text"
                    value={sceneVariationColorScheme}
                    onChange={(e) => setSceneVariationColorScheme(e.target.value)}
                    placeholder="例如：明亮自然光"
                    className="ui-input-compact"
                  />
                </div>

                <ShowProductToggle value={sceneVariationShowProduct} onChange={setSceneVariationShowProduct} />

                <AspectRatioSelect
                  id="scene-variation-aspect-ratio-select"
                  value={sceneVariationAspectRatio}
                  onChange={setSceneVariationAspectRatio}
                />

                <div className="space-y-2">
                  <label className="ui-label">生成数量</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 3, 4].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSceneVariationCount(num)}
                        className={`cursor-pointer py-2 rounded-lg text-xs font-bold transition-all border ${sceneVariationCount === num ? 'ui-segment-active' : 'ui-segment-inactive'}`}
                      >
                        {num}张
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: SCENE CONFIG (创作新场景) */}
            {subTab === 'scene' && (
              <div className="space-y-5" id="parameter-product-scene">
                <div className="space-y-2">
                  <label className="ui-label">场景描述</label>
                  <p className="text-[11px] text-muted-foreground leading-none mt-0.5">产品品类/场景描述 <span className="text-red-500">*</span></p>
                  <textarea 
                    value={sceneDesc}
                    onChange={(e) => setSceneDesc(e.target.value)}
                    placeholder="例如：清洁片在现代厨房使用，明亮自然光，突出泡腾清洁感"
                    className="w-full h-24 bg-white rounded-lg border border-border focus:border-primary focus:outline-none p-3 text-xs text-foreground placeholder:text-muted-foreground resize-none transition-colors leading-relaxed"
                  />
                </div>

                <div className="space-y-2">
                  <label className="ui-label">产品品类 (可选)</label>
                  <input
                    type="text"
                    value={sceneProductCategory}
                    onChange={(e) => setSceneProductCategory(e.target.value)}
                    placeholder="例如：清洁片"
                    className="ui-input-compact"
                  />
                </div>

                <div className="space-y-2">
                  <label className="ui-label">卖点 (可选)</label>
                  <input
                    type="text"
                    value={sceneSellingPoints}
                    onChange={(e) => setSceneSellingPoints(e.target.value)}
                    placeholder="例如：泡腾清洁，厨房清洁"
                    className="ui-input-compact"
                  />
                </div>

                <div className="space-y-2">
                  <label className="ui-label">色系 (可选)</label>
                  <input
                    type="text"
                    value={sceneColorScheme}
                    onChange={(e) => setSceneColorScheme(e.target.value)}
                    placeholder="例如：明亮自然光"
                    className="ui-input-compact"
                  />
                </div>

                <AspectRatioSelect
                  id="scene-aspect-ratio-select"
                  value={sceneAspectRatio}
                  onChange={setSceneAspectRatio}
                />

                <ShowProductToggle value={sceneShowProduct} onChange={setSceneShowProduct} />

                <ImageUploader
                  batch={sceneRefBatch}
                  onBatchChange={setSceneRefBatch}
                  page="product"
                  feature="sceneRef"
                  label="风格参考图 (选填)"
                  placeholder="点击、拖拽或粘贴上传"
                  optional
                />

                {/* Count selector slider buttons */}
                <div className="space-y-2" id="scene-count-selector">
                  <label className="ui-label">生成数量</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[2, 4, 8].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSceneCount(num)}
                        className={`cursor-pointer py-1.5 rounded-lg text-xs font-bold font-mono transition-all border ${sceneCount === num ? 'ui-segment-active' : 'ui-segment-inactive'}`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: PROMPT-ONLY MAIN ASSET */}
            {subTab === 'promptAsset' && (
              <div className="space-y-5" id="parameter-product-prompt-asset">
                <div className="space-y-2">
                  <label className="ui-label">
                    主图/素材描述 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={promptAssetPrompt}
                    onChange={(e) => setPromptAssetPrompt(e.target.value)}
                    placeholder="例如：生成一张洗衣清洁片广告素材，粉色背景，泡泡、水流、清新感"
                    className="w-full h-28 bg-white rounded-lg border border-border focus:border-primary focus:outline-none p-3 text-xs text-foreground placeholder:text-muted-foreground resize-none transition-colors"
                  />
                </div>

                <ImageUploader
                  batch={promptAssetBatch}
                  onBatchChange={setPromptAssetBatch}
                  page="product"
                  feature="promptAssetRef"
                  label="风格/参考图 (选填，仅一阶段使用)"
                  optional
                />

                <div className="space-y-2">
                  <label className="ui-label">产品名称 (可选)</label>
                  <input
                    type="text"
                    value={promptAssetProductName}
                    onChange={(e) => setPromptAssetProductName(e.target.value)}
                    placeholder="例如：Laundry Cleaning Sheets"
                    className="ui-input-compact"
                  />
                </div>

                <div className="space-y-2">
                  <label className="ui-label">卖点 (可选)</label>
                  <input
                    type="text"
                    value={promptAssetSellingPoints}
                    onChange={(e) => setPromptAssetSellingPoints(e.target.value)}
                    placeholder="例如：深层清洁，可用逗号分隔"
                    className="ui-input-compact"
                  />
                </div>

                <div className="space-y-2">
                  <label className="ui-label">色系 (可选)</label>
                  <input
                    type="text"
                    value={promptAssetColorScheme}
                    onChange={(e) => setPromptAssetColorScheme(e.target.value)}
                    placeholder="例如：粉色背景"
                    className="ui-input-compact"
                  />
                </div>

                <AspectRatioSelect
                  id="prompt-asset-aspect-ratio-select"
                  value={promptAssetAspectRatio}
                  onChange={setPromptAssetAspectRatio}
                />

                <div className="space-y-2">
                  <label className="ui-label">生成数量</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[4, 8].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setPromptAssetCount(num)}
                        className={`cursor-pointer py-2 rounded-lg text-xs font-bold transition-all border ${promptAssetCount === num ? 'ui-segment-active' : 'ui-segment-inactive'}`}
                      >
                        {num}张
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Bottom Generation Parameter CTA */}
          <div className="pt-4 border-t border-border" id="product-cta">
            <button
              onClick={() => runProcessing(subTab)}
              disabled={isSubmitting}
              className={`cursor-pointer w-full py-3.5 px-4 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200  ${
                isSubmitting
                  ? 'bg-primary/80 text-primary-foreground cursor-wait'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
              }`}
            >
              <Sparkles className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
              {isSubmitting ? '提交中...' : '开始生成'}
            </button>
          </div>

        </div>

        {/* Right Side Rendering Window Area */}
        <div className="ui-preview-panel justify-between" id="product-workspace-preview">
          
          <div className="h-full flex flex-col justify-between">
            
            {/* Progress overlay when task is active */}
            {taskInProgress && (
              <div className="mb-6 p-4 rounded-lg bg-white border border-primary/10 shadow-sm animate-pulse" id="product-progress-overlay">
                <div className="flex items-center justify-between text-xs text-foreground mb-2 font-mono">
                  <span className="font-sans flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                    {activeTask?.status === 'running' ? 'AI 模型正在处理...' : activeTask?.status === 'queued' ? '任务排队中...' : '正在提交任务...'}
                  </span>
                  <span>{formatTaskProgress(activeTask, activeCount)}</span>
                </div>
                <div className="w-full bg-white rounded-full h-1 overflow-hidden">
                  <div
                    className="bg-primary h-1 transition-all duration-300"
                    style={{
                      width: `${Math.max(
                        activeTask?.status === 'queued' ? 10 : 0,
                        (activeProgress.completed / Math.max(activeProgress.total, 1)) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="mb-6 p-4 rounded-lg bg-red-950/40 border border-red-500/20 text-red-300 text-xs">
                {error}
              </div>
            )}

            {/* TAB-BY-TAB RENDERING OF COMPLETED OUTPUT VIEWS */}

            {/* Sub-Tab 1: 去除产品 (Remove Product) */}
            {subTab === 'remove' && (
              <GenerationResult
                mode="single"
                state={showTaskResults ? (taskInProgress ? 'running' : 'completed') : 'empty'}
                results={activeTask?.images[0] ? [{ id: 'remove-0', imageUrl: activeTask.images[0], badge: 'Completed', taskId: activeTask.taskId }] : []}
                emptyDescription="请在左侧上传待处理的原图并设置相应参数。AI 将自动识别并完美去除指定目标。"
                onOpenDirectory={() => handleOpenOutputDirectory()}
                onOpenDirectoryAll={handleOpenOutputDirectory}
              />
            )}

            {/* Sub-Tab 2: 替换产品 (Replace Product) */}
            {subTab === 'replace' && (
              <GenerationResult
                mode="single"
                state={showTaskResults ? (taskInProgress ? 'running' : 'completed') : 'empty'}
                results={activeTask?.images[0] ? [{ id: 'replace-0', imageUrl: activeTask.images[0], badge: 'COMPLETED-SYNTH' }] : []}
                emptyDescription="上传原场景和目标产品，然后配置您的选择以生成无缝合成图。"
                onOpenDirectory={() => handleOpenOutputDirectory()}
                onOpenDirectoryAll={handleOpenOutputDirectory}
              />
            )}

            {/* Sub-Tab 3: 替换Logo (Replace Logo) */}
            {subTab === 'logo' && (
              <GenerationResult
                mode="single"
                state={showTaskResults ? (taskInProgress ? 'running' : 'completed') : 'empty'}
                results={activeTask?.images[0] ? [{ id: 'logo-0', imageUrl: activeTask.images[0], badge: 'Completed', taskId: activeTask.taskId }] : []}
                emptyDescription="请先上传原图和透明背景新 Logo，并框选替换区域。AI 将只替换品牌标识。"
                onOpenDirectory={() => handleOpenOutputDirectory()}
                onOpenDirectoryAll={handleOpenOutputDirectory}
              />
            )}

            {/* Sub-Tab 4: 主图裂变 (Main Image Variation) */}
            {subTab === 'theme' && (
              <GenerationResult
                mode="multi"
                state={showTaskResults ? (taskInProgress ? 'running' : 'completed') : 'empty'}
                results={(activeTask?.images ?? []).map((img, i) => ({
                  id: `theme-${i}`,
                  imageUrl: img,
                }))}
                placeholders={getTaskProgress(activeTask, themeCount).total}
                count={getTaskProgress(activeTask, themeCount).total}
                showCount
                progressLabel={formatTaskProgress(activeTask, themeCount)}
                emptyDescription="上传场景参考图并设置提示词，AI 将生成主图素材裂变结果。"
                onOpenDirectory={() => handleOpenOutputDirectory()}
                onOpenDirectoryAll={handleOpenOutputDirectory}
              />
            )}

            {/* Sub-Tab 5: 场景裂变 */}
            {subTab === 'sceneVariation' && (
              <GenerationResult
                mode="multi"
                state={showTaskResults ? (taskInProgress ? 'running' : 'completed') : 'empty'}
                results={(activeTask?.images ?? []).map((img, i) => ({
                  id: `scene-variation-${i}`,
                  imageUrl: img,
                }))}
                placeholders={getTaskProgress(activeTask, sceneVariationCount).total}
                count={getTaskProgress(activeTask, sceneVariationCount).total}
                showCount
                progressLabel={formatTaskProgress(activeTask, sceneVariationCount)}
                emptyDescription="上传场景参考图并配置参数，AI 将生成同品类可用的新使用场景素材。"
                onOpenDirectory={() => handleOpenOutputDirectory()}
                onOpenDirectoryAll={handleOpenOutputDirectory}
              />
            )}

            {/* Sub-Tab 6: 创作新场景 (Create New Scene) */}
            {subTab === 'scene' && (
              <GenerationResult
                mode="multi"
                state={showTaskResults ? (taskInProgress ? 'running' : 'completed') : 'empty'}
                results={(activeTask?.images ?? []).map((img, i) => ({
                  id: `scene-${i}`,
                  imageUrl: img,
                  badge: 'Completed',
                }))}
                placeholders={getTaskProgress(activeTask, sceneCount).total}
                count={getTaskProgress(activeTask, sceneCount).total}
                showCount
                progressLabel={formatTaskProgress(activeTask, sceneCount)}
                emptyDescription="输入产品品类/场景描述，AI 将创作全新的电商场景图。"
                onOpenDirectory={() => handleOpenOutputDirectory()}
                onOpenDirectoryAll={handleOpenOutputDirectory}
              />
            )}

            {/* Sub-Tab 7: 纯提示词主图 */}
            {subTab === 'promptAsset' && (
              <GenerationResult
                mode="multi"
                state={showTaskResults ? (taskInProgress ? 'running' : 'completed') : 'empty'}
                results={(activeTask?.images ?? []).map((img, i) => ({
                  id: `prompt-asset-${i}`,
                  imageUrl: img,
                  badge: 'Completed',
                }))}
                placeholders={getTaskProgress(activeTask, promptAssetCount).total}
                count={getTaskProgress(activeTask, promptAssetCount).total}
                showCount
                progressLabel={formatTaskProgress(activeTask, promptAssetCount)}
                emptyDescription="输入主图/素材描述，可选上传风格参考图。图片仅用于一阶段生成执行指令。"
                onOpenDirectory={() => handleOpenOutputDirectory()}
                onOpenDirectoryAll={handleOpenOutputDirectory}
              />
            )}

          </div>

        </div>

      </div>
    </div>
  );
}

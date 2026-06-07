import React, { useEffect, useState } from 'react';
import { 
  Sparkles, 
  Clock, 
  FolderOpen, 
  HelpCircle,
  Maximize2,
  Cpu,
} from 'lucide-react';
import type { StickerSubTab } from '../shared/view/ui';
import type { ImportBatch } from '../shared/domain/images';
import { useImageTask } from '../hooks/useImageTask';
import { useOpenOutputDirectory } from '../hooks/useOpenOutputDirectory';
import type { ImageTaskRequest, ImageFeature, RegionInput } from '../shared/domain/imageFeatureApi';
import ImageUploader from './ImageUploader';
import RegionSelector from './RegionSelector';
import GenerationResult from './GenerationResult';
import AspectRatioSelect, { DEFAULT_IMAGE_ASPECT_RATIO } from './AspectRatioSelect';
import type { ImageAspectRatioValue } from '../shared/view/imageAspectRatioOptions';
import type { TaskRecord } from '../shared/domain/tasks';
import { getFeatureRoute } from '../shared/view/featureRoutes';
import { applyStickerRestore } from '../features/tasks/applyStickerRestore';
import {
  formatTaskProgress,
  getTaskProgress,
  hasPartialOrCompleteResults,
  isTaskInProgress,
} from '../features/tasks/taskProgress';
import { imageTaskRecordFromTaskRecord } from '../features/tasks/taskRestoreHelpers';
import { toDisplaySrc } from '../lib/fileUrl';
import { useDesktopClient } from '../hooks/useDesktopClient';

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
  const [copyRegion, setCopyRegion] = useState<RegionInput | null>(null);

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
    setCopyRegion(restored.copyRegion);
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

  const copyProgress = getTaskProgress(activeTask, copyCount);
  const variationProgress = getTaskProgress(activeTask, variationCount);
  const originalProgress = getTaskProgress(activeTask, originalCount);
  const showTaskResults = hasPartialOrCompleteResults(activeTask);
  const taskInProgress = isTaskInProgress(activeTask);

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

    const images: ImageTaskRequest['images'] = [];

    if (type === 'copy') {
      if (copyBatch && copyBatch.images.length > 0) {
        images.push({ role: 'source', path: copyBatch.images[0].filePath });
      }
      if (copyLogo && copyLogo.images.length > 0) {
        images.push({ role: 'reference', path: copyLogo.images[0].filePath });
      }
    } else if (type === 'variation' && variationBatch && variationBatch.images.length > 0) {
      images.push({ role: 'source', path: variationBatch.images[0].filePath });
    } else if (type === 'original' && originalBatch && originalBatch.images.length > 0) {
      images.push({ role: 'style', path: originalBatch.images[0].filePath });
    }

    const request: ImageTaskRequest = {
      feature: FEATURE_MAP[type],
      images,
      count: type === 'copy' ? copyCount : type === 'variation' ? variationCount : originalCount,
      ...(type === 'copy' && {
        prompt: copyPrompt || undefined,
        productName: copyProductName || undefined,
        logoText: copyLogoText || undefined,
        colorScheme: copyColorScheme || undefined,
        aspectRatio: copyAspectRatio,
        regions: copyRegion ? [copyRegion] : undefined,
      }),
      ...(type === 'variation' && {
        colorScheme: variationColorScheme || undefined,
        prompt: variationPrompt || undefined,
        aspectRatio: variationAspectRatio,
      }),
      ...(type === 'original' && {
        productName: originalBrand || undefined,
        productCategory: originalCategory || undefined,
        sellingPoints: originalSellingPoint ? [originalSellingPoint] : undefined,
        capacity: originalVolume || undefined,
        logoText: originalBrand || undefined,
        colorScheme: originalColorScheme || undefined,
        aspectRatio: originalAspectRatio,
        prompt: originalStyle ? `Style: ${originalStyle}` : undefined,
      }),
    };

    try {
      await submit(request);
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

      {/* Main Workspace Body Split into Left Parameters & Right Preview Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Parameters Form Column */}
        <div className="ui-param-panel" id="sticker-parameters">
          
          {/* Inner scrolling values container */}
          <div className="space-y-6">
            
            {/* SUB-TAB 1: STICKER COPY */}
            {subTab === 'copy' && (
              <div className="space-y-5" id="parameter-sticker-copy">
                <ImageUploader
                  batch={copyBatch}
                  onBatchChange={(batch) => {
                    setCopyBatch(batch);
                    if (!batch) setCopyRegion(null);
                  }}
                  page="sticker"
                  feature="copy"
                  label="参考图片 (Reference Image)"
                />

                {copyBatch && copyBatch.images[0] && (
                  <RegionSelector
                    imagePath={copyBatch.images[0].filePath}
                    imageRole="source"
                    region={copyRegion}
                    onRegionChange={setCopyRegion}
                    operationHint="extract sticker area"
                  />
                )}

                <ImageUploader
                  batch={copyLogo}
                  onBatchChange={setCopyLogo}
                  page="sticker"
                  feature="logo"
                  label="Logo 图片"
                  optional
                  placeholder="点击、拖拽或粘贴上传 Logo"
                />

                {/* Prompt Section */}
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

                <div className="space-y-2">
                  <label className="ui-label">附加提示词 (可选)</label>
                  <textarea
                    id="copy-prompt-input"
                    value={copyPrompt}
                    onChange={(e) => setCopyPrompt(e.target.value)}
                    placeholder="例如：换成 wkau，容量写 6PIECES，整体更清爽"
                    className="ui-textarea h-20 text-xs"
                  />
                </div>

                <div className="space-y-2">
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

                <AspectRatioSelect
                  id="copy-aspect-ratio-select"
                  value={copyAspectRatio}
                  onChange={setCopyAspectRatio}
                  label="图片比例 (Aspect Ratio)"
                />
              </div>
            )}

            {/* SUB-TAB 2: STICKER VARIATION */}
            {subTab === 'variation' && (
              <div className="space-y-5" id="parameter-sticker-variation">
                <ImageUploader
                  batch={variationBatch}
                  onBatchChange={setVariationBatch}
                  page="sticker"
                  feature="variation"
                  label="参考图片 (Reference Sticker)"
                />

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

                {/* Optional description Prompt Box */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="ui-label">附加提示词 (Prompt)</label>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider font-semibold">Optional</span>
                  </div>
                  <textarea 
                    id="variation-prompt-input"
                    value={variationPrompt}
                    onChange={(e) => setVariationPrompt(e.target.value)}
                    placeholder="描述想要微调的细节，例如：增加亮度、改为极简风格..."
                    className="ui-textarea h-20 text-xs"
                  />
                </div>

                <AspectRatioSelect
                  id="variation-aspect-ratio-select"
                  value={variationAspectRatio}
                  onChange={setVariationAspectRatio}
                />

                {/* Generate Count Toggle */}
                <div className="space-y-2">
                  <label className="ui-label">生成数量</label>
                  <div className="grid grid-cols-2 gap-2" id="variation-count-toggle">
                    {[4, 8].map((num) => (
                      <button
                        key={num}
                        id={`variation-count-${num}`}
                        onClick={() => setVariationCount(num)}
                        className={`cursor-pointer py-2 rounded-lg text-xs font-bold transition-all border ${variationCount === num ? 'bg-slate-100 text-foreground border-primary' : 'ui-segment-inactive'}`}
                      >
                        {num} 张
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 3: STICKER ORIGINAL */}
            {subTab === 'original' && (
              <div className="space-y-5" id="parameter-sticker-original">
                <ImageUploader
                  batch={originalBatch}
                  onBatchChange={setOriginalBatch}
                  page="sticker"
                  feature="original"
                  label="风格参考 (选项)"
                  placeholder="点击、拖拽或粘贴上传图片"
                  optional
                />

                {/* Structured Inputs */}
                <div className="space-y-3">
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

                  <div className="space-y-2">
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
                </div>

                <AspectRatioSelect
                  id="original-aspect-ratio-select"
                  value={originalAspectRatio}
                  onChange={setOriginalAspectRatio}
                />

                <div className="space-y-2">
                  <label className="ui-label">生成数量</label>
                  <div className="grid grid-cols-2 gap-2" id="original-count-toggle">
                    {[4, 8].map((num) => (
                      <button
                        key={num}
                        id={`original-count-${num}`}
                        onClick={() => setOriginalCount(num)}
                        className={`cursor-pointer py-2 rounded-lg text-xs font-bold transition-all border ${originalCount === num ? 'bg-slate-100 text-foreground border-primary' : 'ui-segment-inactive'}`}
                      >
                        {num} 张
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Bottom Generation CTA Trigger Button */}
          <div className="pt-4 border-t border-border" id="generator-cta-area">
            <button
              id={`submit-sticker-${subTab}`}
              onClick={() => runGeneration(subTab)}
              disabled={isSubmitting}
              className={`cursor-pointer w-full py-3.5 px-4 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200  ${
                isSubmitting
                  ? 'bg-primary/80 text-primary-foreground cursor-wait'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] '
              }`}
            >
              <Sparkles className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
              {isSubmitting ? '提交中...' : '开始生成'}
            </button>
          </div>

        </div>

        {/* Right Side: Interactive Preview Canvas Panel */}
        <div className="ui-preview-panel justify-between" id="sticker-workspace-preview">
          
          <div>
            {/* Header toolbar stats based on the tab states */}
            {subTab === 'copy' && (
              <div className="flex items-center justify-between mb-4" id="copy-preview-header">
                <div className="flex flex-col">
                  <h3 className="text-sm font-semibold text-foreground">生成结果</h3>
                  <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                    {formatTaskProgress(activeTask, copyCount)}
                  </p>
                </div>
              </div>
            )}

            {subTab === 'variation' && (
              <div className="flex items-center justify-between mb-4 animate-fadeIn" id="variation-preview-header">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 text-[15px]">
                    生成结果 ({variationProgress.total})
                  </h3>
                  {activeTask?.taskId && (
                    <span className="text-[10px] font-mono bg-white border border-border text-muted-foreground px-2 py-0.5 rounded font-bold uppercase tracking-wider mt-0.5">
                      {activeTask.taskId.slice(0, 8)}
                    </span>
                  )}
                </div>
                {showTaskResults && (
                  <button
                    type="button"
                    onClick={handleOpenOutputDirectory}
                    className="cursor-pointer text-[11px] bg-white hover:bg-slate-100 border border-border hover:border-slate-300 text-foreground font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                    打开目录
                  </button>
                )}
              </div>
            )}

            {/* Progress indicators when task is active */}
            {taskInProgress && (
              <div className="mb-6 p-4 rounded-lg bg-white border border-primary/10 shadow-sm animate-pulse" id="generation-progress-box">
                <div className="flex items-center justify-between text-xs text-foreground mb-2 font-mono">
                  <span className="font-sans flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                    {activeTask?.status === 'running' ? 'AI 模型正在生成...' : activeTask?.status === 'queued' ? '任务排队中...' : '正在提交任务...'}
                  </span>
                  <span>{formatTaskProgress(activeTask, subTab === 'copy' ? copyCount : subTab === 'variation' ? variationCount : originalCount)}</span>
                </div>
                <div className="w-full bg-white rounded-full h-1 overflow-hidden">
                  <div
                    className="bg-primary h-1 transition-all duration-300"
                    style={{
                      width: `${Math.max(
                        activeTask?.status === 'queued' ? 10 : 0,
                        ((subTab === 'copy' ? copyProgress : subTab === 'variation' ? variationProgress : originalProgress).completed
                          / Math.max((subTab === 'copy' ? copyProgress : subTab === 'variation' ? variationProgress : originalProgress).total, 1)) * 100,
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

            {/* Results Grid container rendering actual structures */}
            {subTab === 'copy' && (
              <div className="grid grid-cols-2 lg:grid-cols-2 gap-4" id="copy-result-grid">
                {Array.from({ length: copyProgress.total }).map((_, idx) => {
                  const imagePath = activeTask?.images[idx];
                  if (imagePath) {
                    return (
                      <div key={idx} className="aspect-square bg-white border border-border hover:border-border rounded-lg overflow-hidden shadow-inner flex items-center justify-center relative p-3">
                        <img src={toDisplaySrc(imagePath)} className="max-w-full max-h-full object-contain rounded-lg" alt="Generated Sticker" />
                        <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 hover:opacity-100 transition-opacity bg-white p-1.5 rounded-lg border border-border">
                          <button type="button" onClick={handleOpenOutputDirectory} className="text-foreground hover:text-muted-foreground" title="打开目录"><FolderOpen className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={idx} className="aspect-square bg-surface-container-low border border-border rounded-lg flex flex-col items-center justify-center gap-2.5 text-muted-foreground font-medium">
                      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-border">
                        <Clock className="w-4 h-4 text-slate-700" />
                      </div>
                      <span className="text-xs text-muted-foreground tracking-wide">等待生成</span>
                    </div>
                  );
                })}
              </div>
            )}

            {subTab === 'variation' && (
              <div className="space-y-4" id="variation-preview-results">
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: variationProgress.total }).map((_, idx) => {
                    const imagePath = activeTask?.images[idx] ?? '';
                    return (
                    <div key={idx} className="aspect-square bg-white border border-border hover:border-border rounded-lg overflow-hidden p-3 flex items-center justify-center relative group">
                      {imagePath ? (
                        <>
                          <img src={toDisplaySrc(imagePath)} className="max-w-full max-h-full object-contain rounded-lg shadow-sm" alt="Sticker result" />
                          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-white border border-border font-mono text-[9px] text-muted-foreground font-medium">
                            {activeTask?.taskId ? activeTask.taskId.slice(0, 8) : `IMG-${idx + 1}`}
                          </div>
                          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                            <button type="button" onClick={handleOpenOutputDirectory} className="cursor-pointer bg-primary hover:bg-slate-800 rounded p-2 text-primary-foreground shadow" title="打开目录"><FolderOpen className="w-4 h-4" /></button>
                            <button className="cursor-pointer bg-slate-800 hover:bg-slate-700 rounded p-2 text-foreground border border-slate-700"><Maximize2 className="w-4 h-4" /></button>
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

                {/* Bottom static pro-tip card block */}
                <div className="p-4 rounded-lg bg-white border border-border flex gap-3 mt-4" id="variation-protip">
                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <h5 className="text-[11px] font-bold text-foreground tracking-wide uppercase leading-none mt-1">Pro Tip: Try "Style Variation"</h5>
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                      If you want to keep the content but change the overall visual language, use the Style Variation mode. It's perfect for converting flat designs into 3D isometric or pencil-sketched versions.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {subTab === 'original' && (
              <GenerationResult
                mode="multi"
                state={showTaskResults ? (taskInProgress ? 'running' : 'completed') : 'empty'}
                results={(activeTask?.images ?? []).map((img, i) => ({
                  id: `original-${i}`,
                  imageUrl: img,
                }))}
                placeholders={originalProgress.total}
                count={originalProgress.total}
                showCount
                progressLabel={formatTaskProgress(activeTask, originalCount)}
                emptyDescription="输入产品类别、品牌或卖点，可选上传风格参考图。生成结果将在此展示。"
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

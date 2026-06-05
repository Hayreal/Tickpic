import React, { useState } from 'react';
import {
  Layers,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Hand,
  Sparkles,
  History,
} from 'lucide-react';
import type { ProductSubTab } from '../shared/view/ui';
import type { ImportBatch } from '../shared/domain/images';
import { useImageTask } from '../hooks/useImageTask';
import type { ImageTaskRequest, ImageFeature } from '../shared/domain/imageFeatureApi';
import ImageUploader from './ImageUploader';
import GenerationResult from './GenerationResult';

const FEATURE_MAP: Record<ProductSubTab, ImageFeature> = {
  remove: 'remove_product',
  replace: 'replace_product',
  logo: 'replace_logo',
  theme: 'main_image_asset_variation',
  scene: 'create_new_scene',
};

export default function ProductProcessing() {
  const [subTab, setSubTab] = useState<ProductSubTab>('remove');
  const { submit, activeTask, isSubmitting, error, reset } = useImageTask();

  // TAB 1: REMOVE PRODUCT state
  const [removeBatch, setRemoveBatch] = useState<ImportBatch | null>(null);
  const [removeDesc, setRemoveDesc] = useState('');

  // TAB 2: REPLACE PRODUCT state
  const [replaceSceneBatch, setReplaceSceneBatch] = useState<ImportBatch | null>(null);
  const [replaceProductBatch, setReplaceProductBatch] = useState<ImportBatch | null>(null);
  const [replaceDesc, setReplaceDesc] = useState('');

  // TAB 3: REPLACE LOGO state
  const [logoSourceBatch, setLogoSourceBatch] = useState<ImportBatch | null>(null);
  const [logoTargetBatch, setLogoTargetBatch] = useState<ImportBatch | null>(null);
  const [logoDesc, setLogoDesc] = useState('');

  // TAB 4: THEME VARIATION state
  const [themeRefBatch, setThemeRefBatch] = useState<ImportBatch | null>(null);
  const [themePrompt, setThemePrompt] = useState('');
  const [themeCount, setThemeCount] = useState<number>(4);

  // TAB 5: SCENE CONFIG state
  const [sceneDesc, setSceneDesc] = useState('');
  const [sceneRefBatch, setSceneRefBatch] = useState<ImportBatch | null>(null);
  const [sceneCount, setSceneCount] = useState<number>(2);

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
      alert('请输入场景参考图以开始裂变分析');
      return;
    }
    if (type === 'scene' && !sceneDesc) {
      alert('请输入产品品类/场景描述');
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
    } else if (type === 'scene' && sceneRefBatch) {
      images.push({ role: 'style', path: sceneRefBatch.images[0].filePath });
    }

    const request: ImageTaskRequest = {
      feature: FEATURE_MAP[type],
      images,
      count: type === 'theme' ? themeCount : type === 'scene' ? sceneCount : 1,
      ...(type === 'remove' && { prompt: removeDesc || undefined }),
      ...(type === 'replace' && { prompt: replaceDesc || undefined }),
      ...(type === 'logo' && { prompt: logoDesc || undefined }),
      ...(type === 'theme' && { prompt: themePrompt || undefined }),
      ...(type === 'scene' && { prompt: sceneDesc }),
    };

    try {
      await submit(request);
    } catch (err) {
      console.error('Task submission failed:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#111015]" id="product-processing-tab-content">
      
      {/* Product Processing Top Sub-Tabs (Pictured in exactly 5 states across Wireframes) */}
      <div className="h-12 bg-[#0e0d12] border-b border-slate-900 flex items-center px-6 gap-6 shrink-0 z-10" id="product-sub-tabs">
        <button 
          id="product-subtab-remove"
          onClick={() => { setSubTab('remove'); }}
          className={`cursor-pointer text-xs font-semibold uppercase tracking-wider relative h-full flex items-center ${subTab === 'remove' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          去除产品
          {subTab === 'remove' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7c3aed]" />}
        </button>
        <button 
          id="product-subtab-replace"
          onClick={() => { setSubTab('replace'); }}
          className={`cursor-pointer text-xs font-semibold uppercase tracking-wider relative h-full flex items-center ${subTab === 'replace' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          替换产品
          {subTab === 'replace' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7c3aed]" />}
        </button>
        <button 
          id="product-subtab-logo"
          onClick={() => { setSubTab('logo'); }}
          className={`cursor-pointer text-xs font-semibold uppercase tracking-wider relative h-full flex items-center ${subTab === 'logo' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          替换Logo
          {subTab === 'logo' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7c3aed]" />}
        </button>
        <button 
          id="product-subtab-theme"
          onClick={() => { setSubTab('theme'); }}
          className={`cursor-pointer text-xs font-semibold uppercase tracking-wider relative h-full flex items-center ${subTab === 'theme' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          主图裂变
          {subTab === 'theme' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7c3aed]" />}
        </button>
        <button 
          id="product-subtab-scene"
          onClick={() => { setSubTab('scene'); }}
          className={`cursor-pointer text-xs font-semibold uppercase tracking-wider relative h-full flex items-center ${subTab === 'scene' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          创作新场景
          {subTab === 'scene' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7c3aed]" />}
        </button>
      </div>

      {/* Split Inner Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Parameters Left Column */}
        <div className="w-[340px] md:w-[380px] bg-[#0c0b10]/60 border-r border-slate-900/80 p-5 flex flex-col justify-between overflow-y-auto shrink-0 select-none" id="product-parameters">
          
          <div className="space-y-6">

            {/* TAB 1: REMOVE PRODUCT (去除产品) */}
            {subTab === 'remove' && (
              <div className="space-y-5" id="parameter-product-remove">
                <div>
                  <p className="text-[10px] text-slate-500 font-sans leading-none mb-1.5">原始产品放置背景图</p>
                  <ImageUploader
                    batch={removeBatch}
                    onBatchChange={setRemoveBatch}
                    page="product"
                    feature="remove"
                    label="待处理原图"
                  />
                </div>


                {/* Free description instructions */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">去除说明 (可选)</label>
                  <textarea 
                    value={removeDesc}
                    onChange={(e) => setRemoveDesc(e.target.value)}
                    placeholder="例如：移除背景中的杂物，保留主要阴影..."
                    className="w-full h-24 bg-slate-950/80 rounded-xl border border-slate-800 focus:border-violet-500 focus:outline-none p-3 text-xs text-white placeholder-slate-600 resize-none transition-colors"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: REPLACE PRODUCT (替换产品) */}
            {subTab === 'replace' && (
              <div className="space-y-5" id="parameter-product-replace">
                <div className="grid grid-cols-2 gap-3">
                  <ImageUploader
                    batch={replaceSceneBatch}
                    onBatchChange={setReplaceSceneBatch}
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


                {/* instructions */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">替换说明 (可选)</label>
                  <textarea 
                    value={replaceDesc}
                    onChange={(e) => setReplaceDesc(e.target.value)}
                    placeholder="例如：确保新产品完美贴合桌面。匹配温暖的晨光和玻璃上的微妙反光。"
                    className="w-full h-24 bg-slate-950/80 rounded-xl border border-slate-800 focus:border-violet-500 focus:outline-none p-3 text-xs text-white placeholder-slate-600 resize-none transition-colors"
                  />
                </div>
              </div>
            )}

            {/* TAB 3: REPLACE LOGO (替换Logo) */}
            {subTab === 'logo' && (
              <div className="space-y-5" id="parameter-product-logo">
                <div className="space-y-4">
                  <ImageUploader
                    batch={logoSourceBatch}
                    onBatchChange={setLogoSourceBatch}
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


                {/* Instructions text */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">替换说明 (Instructions - 可选)</label>
                  <textarea 
                    value={logoDesc}
                    onChange={(e) => setLogoDesc(e.target.value)}
                    placeholder="例如：只替换左上角品牌标识，保持原有透视和光影"
                    className="w-full h-20 bg-slate-950/80 rounded-xl border border-slate-800 focus:border-violet-500 focus:outline-none p-3 text-xs text-white placeholder-slate-600 resize-none transition-colors"
                  />
                </div>
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
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">附加提示词 (Prompt)</label>
                  <textarea 
                    value={themePrompt}
                    onChange={(e) => setThemePrompt(e.target.value)}
                    placeholder="例如：将其放置在充满阳光的现代极简客厅中，木质茶几，背景有绿植..."
                    className="w-full h-24 bg-slate-950/80 rounded-xl border border-slate-800 focus:border-violet-500 focus:outline-none p-3 text-xs text-white placeholder-slate-600 resize-none transition-colors"
                  />
                </div>

                {/* Count Select */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">生成数量</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 4, 8].map((num) => (
                      <button
                        key={num}
                        onClick={() => setThemeCount(num)}
                        className={`cursor-pointer py-2 rounded-lg text-xs font-bold transition-all border ${themeCount === num ? 'bg-violet-950/20 text-white border-violet-500' : 'bg-transparent text-slate-500 border-slate-900'}`}
                      >
                        {num}张
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: SCENE CONFIG (创作新场景) */}
            {subTab === 'scene' && (
              <div className="space-y-5" id="parameter-product-scene">
                {/* Product spec block text description */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">场景配置</label>
                  <p className="text-[11px] text-slate-500 leading-none mt-0.5">产品品类/场景描述 <span className="text-red-500">*</span></p>
                  <textarea 
                    value={sceneDesc}
                    onChange={(e) => setSceneDesc(e.target.value)}
                    placeholder="例如：简约现代的木质咖啡桌，放置在明亮的北欧风格客厅，阳光透过落地窗洒在桌面。"
                    className="w-full h-24 bg-slate-950/80 rounded-xl border border-slate-800 focus:border-violet-500 focus:outline-none p-3 text-xs text-white placeholder-slate-600 resize-none transition-colors leading-relaxed"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">详细描述您想要生成的场景氛围和细节，以获得更好的结果。</p>
                </div>

                <ImageUploader
                  batch={sceneRefBatch}
                  onBatchChange={setSceneRefBatch}
                  page="product"
                  feature="sceneRef"
                  label="参考图 (选填)"
                  placeholder="点击、拖拽或粘贴上传"
                  optional
                />

                {/* Count selector slider buttons */}
                <div className="space-y-2" id="scene-count-selector">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">生成数量</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 4, 8].map((num) => (
                      <button
                        key={num}
                        onClick={() => setSceneCount(num)}
                        className={`cursor-pointer py-1.5 rounded-lg text-xs font-bold font-mono transition-all border ${sceneCount === num ? 'bg-violet-950/20 text-white border-violet-500' : 'bg-transparent text-slate-500 border-slate-900 hover:text-slate-200'}`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Bottom Generation Parameter CTA */}
          <div className="pt-4 border-t border-slate-900/60" id="product-cta">
            <button
              onClick={() => runProcessing(subTab)}
              disabled={isSubmitting}
              className={`cursor-pointer w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 shadow-lg ${
                isSubmitting 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50' 
                  : 'bg-[#7c3aed] text-white hover:bg-[#8b5cf6] active:scale-[0.98]'
              }`}
            >
              <Sparkles className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
              {isSubmitting ? '正在执行产品处理...' : '开始生成'}
            </button>
          </div>

        </div>

        {/* Right Side Rendering Window Area */}
        <div className="flex-1 bg-[#0b0a0e]/40 p-6 flex flex-col justify-between overflow-y-auto" id="product-workspace-preview">
          
          <div className="h-full flex flex-col justify-between">
            
            {/* Progress overlay when task is active */}
            {(isSubmitting || (activeTask && (activeTask.status === 'queued' || activeTask.status === 'running'))) && (
              <div className="mb-6 p-4 rounded-xl bg-slate-950/80 border border-violet-500/10 shadow-sm animate-pulse" id="product-progress-overlay">
                <div className="flex items-center justify-between text-xs text-white mb-2 font-mono">
                  <span className="font-sans flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                    {activeTask?.status === 'running' ? 'AI 模型正在处理...' : activeTask?.status === 'queued' ? '任务排队中...' : '正在提交任务...'}
                  </span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
                  <div className="bg-gradient-to-r from-violet-600 to-indigo-500 h-1 transition-all duration-300 animate-pulse" style={{ width: activeTask?.status === 'running' ? '60%' : activeTask?.status === 'queued' ? '20%' : '10%' }} />
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/20 text-red-300 text-xs">
                {error}
              </div>
            )}

            {/* TAB-BY-TAB RENDERING OF COMPLETED OUTPUT VIEWS */}

            {/* Sub-Tab 1: 去除产品 (Remove Product) */}
            {subTab === 'remove' && (
              <GenerationResult
                mode="single"
                state={activeTask?.status === 'completed' && activeTask.images.length > 0 ? 'completed' : 'empty'}
                results={activeTask?.status === 'completed' && activeTask.images.length > 0 ? [{ id: 'remove-0', imageUrl: activeTask.images[0], badge: 'Completed', taskId: activeTask.taskId }] : []}
                emptyDescription="请在左侧上传待处理的原图并设置相应参数。AI 将自动识别并完美去除指定目标。"
              />
            )}

            {/* Sub-Tab 2: 替换产品 (Replace Product) */}
            {subTab === 'replace' && (
              <GenerationResult
                mode="single"
                state={activeTask?.status === 'completed' && activeTask.images.length > 0 ? 'completed' : 'empty'}
                results={activeTask?.status === 'completed' && activeTask.images.length > 0 ? [{ id: 'replace-0', imageUrl: activeTask.images[0], badge: 'COMPLETED-SYNTH' }] : []}
                emptyDescription="上传原场景和目标产品，然后配置您的选择以生成无缝合成图。"
              />
            )}

            {/* Sub-Tab 3: 替换Logo (Replace Logo) */}
            {subTab === 'logo' && (
              <div className="flex-1 flex flex-col bg-slate-950/10 rounded-xl border border-slate-900/40 overflow-hidden h-full min-h-[380px]" id="preview-logo">
                {/* Header toolbar for Logo Placement canvas */}
                <div className="h-10 bg-slate-950/80 border-b border-slate-900 flex items-center justify-between px-4 text-xs select-none">
                  <div className="flex items-center gap-3">
                    <button className="text-slate-400 hover:text-white transition-colors duration-100 cursor-pointer"><ZoomIn className="w-4 h-4" /></button>
                    <button className="text-slate-400 hover:text-white transition-colors duration-100 cursor-pointer"><ZoomOut className="w-4 h-4" /></button>
                    <button className="text-slate-400 hover:text-white transition-colors duration-100 cursor-pointer border-l border-slate-900 pl-3"><Hand className="w-4 h-4" /></button>
                  </div>
                  <button className="text-[10px] text-slate-500 hover:text-[#a78bfa] font-mono uppercase tracking-wider font-semibold cursor-pointer">Reset View</button>
                </div>
                
                {/* Interactive Logo placement grid checked board backdrop container */}
                <div className="flex-1 flex flex-col items-center justify-center relative p-12 bg-[#09080d]" style={{ backgroundImage: 'radial-gradient(#181622 1px, transparent 1px)', backgroundSize: '16px 16px' }} id="logo-place-canvas">
                  
                  {activeTask?.status === 'completed' && activeTask.images.length > 0 ? (
                    <div className="w-full max-w-sm aspect-square bg-[#100e16] border border-slate-800 rounded-xl flex items-center justify-center relative animate-fadeIn shadow-lg">
                      <img src={activeTask.images[0]} className="max-h-full max-w-full" alt="Logo Result" />
                      <div className="absolute top-4 left-4 bg-[#7c3aed] text-white font-mono text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                        AI OVERLAY OK
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-center text-slate-600 mb-4 shadow">
                        <Layers className="w-6 h-6 text-slate-600" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-300 font-mono tracking-wider">Ready to Process</h4>
                      <p className="text-[11px] text-slate-500 text-center max-w-sm mt-2.5 leading-relaxed font-sans">
                        Upload a source image and target logo on the left panel to begin.
                      </p>
                    </>
                  )}

                </div>
              </div>
            )}

            {/* Sub-Tab 4: 主图裂变 (Main Image Variation) */}
            {subTab === 'theme' && (
              <GenerationResult
                mode="multi"
                state={activeTask?.status === 'completed' && activeTask.images.length > 0 ? 'completed' : 'empty'}
                results={(activeTask?.status === 'completed' ? activeTask.images : []).map((img, i) => ({
                  id: `theme-${i}`,
                  imageUrl: img,
                }))}
                count={activeTask?.status === 'completed' ? activeTask.images.length : themeCount}
                showCount
                emptyDescription="上传场景参考图并设置提示词，AI 将生成主图素材裂变结果。"
              />
            )}

            {/* Sub-Tab 5: 创作新场景 (Create New Scene) */}
            {subTab === 'scene' && (
              <GenerationResult
                mode="multi"
                state={activeTask?.status === 'completed' && activeTask.images.length > 0 ? 'completed' : 'empty'}
                results={(activeTask?.status === 'completed' ? activeTask.images : []).map((img, i) => ({
                  id: `scene-${i}`,
                  imageUrl: img,
                  badge: 'Completed',
                }))}
                emptyDescription="输入产品品类/场景描述，AI 将创作全新的电商场景图。"
                headerRight={
                  <button className="cursor-pointer text-[10px] font-mono bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded px-2.5 py-1 text-slate-400 flex items-center gap-1">
                    <History className="w-3.5 h-3.5 text-slate-500" />
                    历史记录
                  </button>
                }
              />
            )}

          </div>

        </div>

      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { 
  Sparkles, 
  Clock, 
  Download, 
  HelpCircle,
  Check, 
  Grid, 
  Maximize2,
  Cpu,
} from 'lucide-react';
import type { StickerSubTab } from '../shared/view/ui';
import type { ImportBatch } from '../shared/domain/images';
import { useImageTask } from '../hooks/useImageTask';
import type { ImageTaskRequest, ImageFeature } from '../shared/domain/imageFeatureApi';
import ImageUploader from './ImageUploader';

const FEATURE_MAP: Record<StickerSubTab, ImageFeature> = {
  copy: 'sticker_replica',
  variation: 'sticker_variation',
  original: 'sticker_original',
};

export default function StickerGen() {
  const [subTab, setSubTab] = useState<StickerSubTab>('copy');
  const { submit, activeTask, isSubmitting, error, reset } = useImageTask();

  // STICKER COPY (Tab 1) state
  const [copyBatch, setCopyBatch] = useState<ImportBatch | null>(null);
  const [copyOutputFormat, setCopyOutputFormat] = useState<'white' | 'transparent'>('white');
  const [copyCount, setCopyCount] = useState<number>(4);
  
  // Copy Tab - New State
  const [copyLogo, setCopyLogo] = useState<ImportBatch | null>(null);
  const [copyProductName, setCopyProductName] = useState('');
  const [copyColorScheme, setCopyColorScheme] = useState('');
  const [copyAspectRatio, setCopyAspectRatio] = useState<'9:16' | '4:3' | '1:1'>('1:1');

  // STICKER VARIATION (Tab 2) state
  const [variationBatch, setVariationBatch] = useState<ImportBatch | null>(null);
  const [variationPrompt, setVariationPrompt] = useState('');
  const [variationCount, setVariationCount] = useState<number>(4);
  
  // Variation Tab - New State
  const [variationColorScheme, setVariationColorScheme] = useState('');

  // STICKER ORIGINAL (Tab 3) state
  const [originalBatch, setOriginalBatch] = useState<ImportBatch | null>(null);
  const [originalCount, setOriginalCount] = useState<number>(4);
  
  // Original Tab - New Structured State
  const [originalCategory, setOriginalCategory] = useState('');
  const [originalBrand, setOriginalBrand] = useState('');
  const [originalSellingPoint, setOriginalSellingPoint] = useState('');
  const [originalVolume, setOriginalVolume] = useState('');
  const [originalStyle, setOriginalStyle] = useState('');
  const [originalColorScheme, setOriginalColorScheme] = useState('');

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

    const batch = type === 'copy' ? copyBatch : type === 'variation' ? variationBatch : originalBatch;

    const images: ImageTaskRequest['images'] = [];
    if (batch && batch.images.length > 0) {
      images.push({ role: 'source', path: batch.images[0].filePath });
    }
    if (type === 'copy' && copyLogo && copyLogo.images.length > 0) {
      images.push({ role: 'logo', path: copyLogo.images[0].filePath });
    }

    const request: ImageTaskRequest = {
      feature: FEATURE_MAP[type],
      images,
      count: type === 'copy' ? copyCount : type === 'variation' ? variationCount : originalCount,
      ...(type === 'copy' && {
        productName: copyProductName || undefined,
        colorScheme: copyColorScheme || undefined,
        aspectRatio: copyAspectRatio,
      }),
      ...(type === 'variation' && {
        colorScheme: variationColorScheme || undefined,
        prompt: variationPrompt || undefined,
      }),
      ...(type === 'original' && {
        productName: originalBrand || undefined,
        productCategory: originalCategory || undefined,
        sellingPoints: originalSellingPoint ? [originalSellingPoint] : undefined,
        capacity: originalVolume || undefined,
        colorScheme: originalColorScheme || undefined,
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
    <div className="flex-1 flex flex-col bg-[#111015]" id="sticker-gen-tab-content">
      {/* Top Secondary Tab Bar */}
      <div className="h-12 bg-[#0e0d12] border-b border-slate-900 flex items-center px-6 gap-6 shrink-0 z-10" id="sticker-sub-tabs">
        <button 
          id="sticker-subtab-copy"
          onClick={() => { setSubTab('copy'); }}
          className={`cursor-pointer text-xs font-semibold uppercase tracking-wider relative h-full flex items-center ${subTab === 'copy' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          贴纸复刻
          {subTab === 'copy' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7c3aed]" />}
        </button>
        <button 
          id="sticker-subtab-variation"
          onClick={() => { setSubTab('variation'); }}
          className={`cursor-pointer text-xs font-semibold uppercase tracking-wider relative h-full flex items-center ${subTab === 'variation' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          贴纸裂变
          {subTab === 'variation' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7c3aed]" />}
        </button>
        <button 
          id="sticker-subtab-original"
          onClick={() => { setSubTab('original'); }}
          className={`cursor-pointer text-xs font-semibold uppercase tracking-wider relative h-full flex items-center ${subTab === 'original' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          贴纸原创
          {subTab === 'original' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7c3aed]" />}
        </button>
      </div>

      {/* Main Workspace Body Split into Left Parameters & Right Preview Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Parameters Form Column */}
        <div className="w-[340px] md:w-[380px] bg-[#0c0b10]/60 border-r border-slate-900/80 p-5 flex flex-col justify-between overflow-y-auto shrink-0 select-none" id="sticker-parameters">
          
          {/* Inner scrolling values container */}
          <div className="space-y-6">
            
            {/* SUB-TAB 1: STICKER COPY */}
            {subTab === 'copy' && (
              <div className="space-y-5" id="parameter-sticker-copy">
                <ImageUploader
                  batch={copyBatch}
                  onBatchChange={setCopyBatch}
                  page="sticker"
                  feature="copy"
                  label="参考图片 (Reference Image)"
                />

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
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">产品名称</label>
                  <input 
                    type="text"
                    id="copy-product-name-input"
                    value={copyProductName}
                    onChange={(e) => setCopyProductName(e.target.value)}
                    placeholder="请输入产品名称"
                    className="w-full h-10 bg-slate-950/80 rounded-xl border border-slate-800 focus:border-violet-500 focus:outline-none px-3 text-xs text-white placeholder-slate-600 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">色系</label>
                  <input 
                    type="text"
                    id="copy-color-scheme-input"
                    value={copyColorScheme}
                    onChange={(e) => setCopyColorScheme(e.target.value)}
                    placeholder="例如：莫兰迪色、高对比度、黑白"
                    className="w-full h-10 bg-slate-950/80 rounded-xl border border-slate-800 focus:border-violet-500 focus:outline-none px-3 text-xs text-white placeholder-slate-600 transition-colors"
                  />
                </div>

                {/* Output Format Toggle */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">输出格式 (Output Format)</label>
                  <div className="grid grid-cols-2 gap-2" id="format-toggle-container">
                    <button 
                      id="format-white-png"
                      onClick={() => setCopyOutputFormat('white')}
                      className={`cursor-pointer py-2.5 rounded-lg text-xs font-medium border transition-all ${copyOutputFormat === 'white' ? 'bg-[#18171e] text-white border-violet-500 shadow-sm' : 'bg-transparent text-slate-400 border-slate-900 hover:text-white'}`}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        {copyOutputFormat === 'white' && <Check className="w-3.5 h-3.5 text-violet-400" />}
                        白底 PNG
                      </span>
                    </button>
                    <button 
                      id="format-transparent-png"
                      onClick={() => setCopyOutputFormat('transparent')}
                      className={`cursor-pointer py-2.5 rounded-lg text-xs font-medium border transition-all ${copyOutputFormat === 'transparent' ? 'bg-[#18171e] text-white border-violet-500 shadow-sm' : 'bg-transparent text-slate-400 border-slate-900 hover:text-white'}`}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        {copyOutputFormat === 'transparent' && <Check className="w-3.5 h-3.5 text-violet-400" />}
                        透明 PNG
                      </span>
                    </button>
                  </div>
                </div>

                {/* Aspect Ratio Select */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">图片比例 (Aspect Ratio)</label>
                  <div className="grid grid-cols-3 gap-2" id="aspect-ratio-grid">
                    {(['9:16', '4:3', '1:1'] as const).map((ratio) => (
                      <button
                        key={ratio}
                        id={`aspect-ratio-${ratio}`}
                        onClick={() => setCopyAspectRatio(ratio)}
                        className={`cursor-pointer py-1.5 rounded-lg text-xs font-bold font-mono transition-all border ${copyAspectRatio === ratio ? 'bg-violet-950/20 text-white border-violet-500' : 'bg-transparent text-slate-500 border-slate-900 hover:text-slate-200'}`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>
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
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">色系</label>
                  <input 
                    type="text"
                    id="variation-color-scheme-input"
                    value={variationColorScheme}
                    onChange={(e) => setVariationColorScheme(e.target.value)}
                    placeholder="例如：莫兰迪色、高对比度、黑白"
                    className="w-full h-10 bg-slate-950/80 rounded-xl border border-slate-800 focus:border-violet-500 focus:outline-none px-3 text-xs text-white placeholder-slate-600 transition-colors"
                  />
                </div>

                {/* Optional description Prompt Box */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">附加提示词 (Prompt)</label>
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-semibold">Optional</span>
                  </div>
                  <textarea 
                    id="variation-prompt-input"
                    value={variationPrompt}
                    onChange={(e) => setVariationPrompt(e.target.value)}
                    placeholder="描述想要微调的细节，例如：增加亮度、改为极简风格..."
                    className="w-full h-20 bg-slate-950/80 rounded-xl border border-slate-800 focus:border-violet-500 focus:outline-none p-3 text-xs text-white placeholder-slate-600 resize-none transition-colors"
                  />
                </div>

                {/* Generate Count Toggle */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">生成数量</label>
                  <div className="grid grid-cols-2 gap-2" id="variation-count-toggle">
                    <button 
                      id="variation-count-4"
                      onClick={() => setVariationCount(4)}
                      className={`cursor-pointer py-2 rounded-lg text-xs font-bold transition-all border ${variationCount === 4 ? 'bg-[#18171e] text-white border-[#7c3aed]' : 'bg-transparent text-slate-500 border-slate-900'}`}
                    >
                      4 Images
                    </button>
                    <button 
                      id="variation-count-8"
                      onClick={() => setVariationCount(8)}
                      className={`cursor-pointer py-2 rounded-lg text-xs font-bold transition-all border ${variationCount === 8 ? 'bg-[#18171e] text-white border-[#7c3aed]' : 'bg-transparent text-slate-500 border-slate-900'}`}
                    >
                      8 Images
                    </button>
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
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      产品品类 <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input 
                      type="text"
                      id="original-category-input"
                      value={originalCategory}
                      onChange={(e) => setOriginalCategory(e.target.value)}
                      placeholder="例如：护肤品、饮料、零食"
                      className="w-full h-10 bg-slate-950/80 rounded-xl border border-slate-800 focus:border-violet-500 focus:outline-none px-3 text-xs text-white placeholder-slate-600 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      品牌 <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input 
                      type="text"
                      id="original-brand-input"
                      value={originalBrand}
                      onChange={(e) => setOriginalBrand(e.target.value)}
                      placeholder="请输入品牌名称"
                      className="w-full h-10 bg-slate-950/80 rounded-xl border border-slate-800 focus:border-violet-500 focus:outline-none px-3 text-xs text-white placeholder-slate-600 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      卖点 <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input 
                      type="text"
                      id="original-selling-point-input"
                      value={originalSellingPoint}
                      onChange={(e) => setOriginalSellingPoint(e.target.value)}
                      placeholder="例如：持久保湿、0糖0卡"
                      className="w-full h-10 bg-slate-950/80 rounded-xl border border-slate-800 focus:border-violet-500 focus:outline-none px-3 text-xs text-white placeholder-slate-600 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">容量/规格</label>
                    <input 
                      type="text"
                      id="original-volume-input"
                      value={originalVolume}
                      onChange={(e) => setOriginalVolume(e.target.value)}
                      placeholder="例如：50ml、100g、1L"
                      className="w-full h-10 bg-slate-950/80 rounded-xl border border-slate-800 focus:border-violet-500 focus:outline-none px-3 text-xs text-white placeholder-slate-600 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">风格</label>
                    <input 
                      type="text"
                      id="original-style-input"
                      value={originalStyle}
                      onChange={(e) => setOriginalStyle(e.target.value)}
                      placeholder="例如：极简、赛博朋克、水彩"
                      className="w-full h-10 bg-slate-950/80 rounded-xl border border-slate-800 focus:border-violet-500 focus:outline-none px-3 text-xs text-white placeholder-slate-600 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">色系</label>
                    <input 
                      type="text"
                      id="original-color-scheme-input"
                      value={originalColorScheme}
                      onChange={(e) => setOriginalColorScheme(e.target.value)}
                      placeholder="例如：莫兰迪色、高对比度、黑白"
                      className="w-full h-10 bg-slate-950/80 rounded-xl border border-slate-800 focus:border-violet-500 focus:outline-none px-3 text-xs text-white placeholder-slate-600 transition-colors"
                    />
                  </div>
                </div>

                {/* Remove Preset Quick tags buttons */}
              </div>
            )}

          </div>

          {/* Bottom Generation CTA Trigger Button */}
          <div className="pt-4 border-t border-slate-900/60" id="generator-cta-area">
            <button
              id={`submit-sticker-${subTab}`}
              onClick={() => runGeneration(subTab)}
              disabled={isSubmitting}
              className={`cursor-pointer w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 shadow-lg ${
                isSubmitting 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50' 
                  : 'bg-[#7c3aed] text-white hover:bg-[#8b5cf6] active:scale-[0.98] shadow-violet-950/20'
              }`}
            >
              <Sparkles className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
              {isSubmitting ? '正在执行创意生成...' : subTab === 'copy' ? '冗奈生成' : '开始生成'}
            </button>
          </div>

        </div>

        {/* Right Side: Interactive Preview Canvas Panel */}
        <div className="flex-1 bg-[#0b0a0e]/40 p-6 flex flex-col justify-between overflow-y-auto" id="sticker-workspace-preview">
          
          <div>
            {/* Header toolbar stats based on the tab states */}
            {subTab === 'copy' && (
              <div className="flex items-center justify-between mb-4" id="copy-preview-header">
                <div className="flex flex-col">
                  <h3 className="text-sm font-semibold text-white">生成结果</h3>
                  <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                    {activeTask?.status === 'completed' ? `${activeTask.images.length} / ${activeTask.images.length} completed` : '0 / 4 completed'}
                  </p>
                </div>
              </div>
            )}

            {subTab === 'variation' && (
              <div className="flex items-center justify-between mb-4 animate-fadeIn" id="variation-preview-header">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5 text-[15px]">
                    生成结果 ({activeTask?.status === 'completed' ? activeTask.images.length : 4})
                  </h3>
                  {activeTask?.taskId && (
                    <span className="text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider mt-0.5">
                      {activeTask.taskId.slice(0, 8)}
                    </span>
                  )}
                </div>
                {activeTask?.status === 'completed' && activeTask.images.length > 0 && (
                  <button className="cursor-pointer text-[11px] bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-white font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                    <Download className="w-3.5 h-3.5 text-violet-400" />
                    Download All
                  </button>
                )}
              </div>
            )}

            {subTab === 'original' && (
              <div className="flex items-center justify-between mb-4" id="original-preview-header">
                <h3 className="text-sm font-semibold text-white">生成结果</h3>
                <div className="flex items-center gap-2">
                  <button className="p-1 text-slate-500"><Grid className="w-4 h-4" /></button>
                  <button className="p-1 text-slate-500"><Maximize2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}

            {/* Progress indicators when task is active */}
            {(isSubmitting || (activeTask && (activeTask.status === 'queued' || activeTask.status === 'running'))) && (
              <div className="mb-6 p-4 rounded-xl bg-slate-950/80 border border-violet-500/10 shadow-sm animate-pulse" id="generation-progress-box">
                <div className="flex items-center justify-between text-xs text-white mb-2 font-mono">
                  <span className="font-sans flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                    {activeTask?.status === 'running' ? 'AI 模型正在生成...' : activeTask?.status === 'queued' ? '任务排队中...' : '正在提交任务...'}
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

            {/* Results Grid container rendering actual structures */}
            {subTab === 'copy' && (
              <div className="grid grid-cols-2 lg:grid-cols-2 gap-4" id="copy-result-grid">
                {activeTask?.status === 'completed' && activeTask.images.length > 0 ? (
                  activeTask.images.map((imagePath, idx) => (
                    <div key={idx} className="aspect-square bg-[#100f13] border border-slate-900 hover:border-slate-800 rounded-xl overflow-hidden shadow-inner flex items-center justify-center relative p-3">
                      <img src={imagePath} className="max-w-full max-h-full object-contain rounded-lg" alt="Generated Sticker" />
                      <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 hover:opacity-100 transition-opacity bg-slate-950/80 p-1.5 rounded-lg border border-slate-800">
                        <button className="text-white hover:text-violet-400"><Download className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))
                ) : (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="aspect-square bg-slate-950/20 border border-slate-900/60 rounded-xl flex flex-col items-center justify-center gap-2.5 text-slate-600 font-medium">
                      <div className="w-10 h-10 rounded-full bg-slate-950/30 flex items-center justify-center border border-slate-900">
                        <Clock className="w-4 h-4 text-slate-700" />
                      </div>
                      <span className="text-xs text-slate-500 tracking-wide">等待生成</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {subTab === 'variation' && (
              <div className="space-y-4" id="variation-preview-results">
                <div className="grid grid-cols-2 gap-4">
                  {(activeTask?.status === 'completed' && activeTask.images.length > 0 ? activeTask.images : Array.from({ length: 4 }).map(() => '')).map((imagePath, idx) => (
                    <div key={idx} className="aspect-square bg-[#100f12] border border-slate-900 hover:border-slate-800 rounded-xl overflow-hidden p-3 flex items-center justify-center relative group">
                      {imagePath ? (
                        <>
                          <img src={imagePath} className="max-w-full max-h-full object-contain rounded-lg shadow-sm" alt="Sticker result" />
                          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800 font-mono text-[9px] text-violet-400 font-medium">
                            {activeTask?.taskId ? activeTask.taskId.slice(0, 8) : `IMG-${idx + 1}`}
                          </div>
                          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                            <button className="cursor-pointer bg-violet-600 hover:bg-violet-500 rounded p-2 text-white shadow"><Download className="w-4 h-4" /></button>
                            <button className="cursor-pointer bg-slate-800 hover:bg-slate-700 rounded p-2 text-slate-300 border border-slate-700"><Maximize2 className="w-4 h-4" /></button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2.5 text-slate-600">
                          <div className="w-10 h-10 rounded-full bg-slate-950/30 flex items-center justify-center border border-slate-900">
                            <Clock className="w-4 h-4 text-slate-700" />
                          </div>
                          <span className="text-xs text-slate-500 tracking-wide">等待生成</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Bottom static pro-tip card block */}
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-900/80 flex gap-3 mt-4" id="variation-protip">
                  <div className="w-8 h-8 rounded-full bg-[#7c3aed]/10 border border-[#7c3aed]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <HelpCircle className="w-4 h-4 text-[#a78bfa]" />
                  </div>
                  <div>
                    <h5 className="text-[11px] font-bold text-slate-300 tracking-wide uppercase leading-none mt-1">Pro Tip: Try "Style Variation"</h5>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                      If you want to keep the content but change the overall visual language, use the Style Variation mode. It's perfect for converting flat designs into 3D isometric or pencil-sketched versions.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {subTab === 'original' && (
              <div className="flex flex-col items-center justify-center min-h-[300px] py-12 px-4 bg-slate-950/10 rounded-xl border border-slate-900/40" id="original-preview-blank">
                {activeTask?.status === 'completed' && activeTask.images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 w-full">
                    {activeTask.images.map((imagePath, idx) => (
                      <div key={idx} className="aspect-square bg-[#100f13] border border-slate-900 hover:border-slate-800 rounded-xl overflow-hidden p-3 flex items-center justify-center relative">
                        <img src={imagePath} className="max-w-full max-h-full object-contain rounded-lg" alt="original layout" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-slate-950/30 flex items-center justify-center text-slate-600 mb-4 border border-slate-900/60 relative">
                      <Sparkles className="w-6 h-6 text-slate-700 absolute inset-0 m-auto animate-pulse" />
                    </div>
                    <p className="text-slate-300 font-semibold text-xs text-center">输入需求并点击开始创作</p>
                    <p className="text-[11px] text-slate-500 text-center mt-1">生成结果将在此实时展示</p>

                    {/* Miniature high detail grid below blank state */}
                    <div className="grid grid-cols-2 gap-3 mt-8 w-full max-w-md" id="original-intro-cards">
                      <div className="p-3 bg-[#0d0c11] border border-slate-900/40 rounded-xl flex flex-col gap-1.5">
                        <span className="text-[16px] text-violet-400">⚡</span>
                        <h6 className="text-[11px] font-semibold text-slate-200 leading-none">极速生成</h6>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-sans">自研大模型，秒级响应</p>
                      </div>
                      <div className="p-3 bg-[#0d0c11] border border-slate-900/40 rounded-xl flex flex-col gap-1.5">
                        <span className="text-[16px] text-violet-400">📺</span>
                        <h6 className="text-[11px] font-semibold text-slate-200 leading-none">高清细节</h6>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-sans">4K超增强技术</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>

          {/* Bottom highlight metadata indicators */}
          {subTab === 'original' && (
            <div className="mt-6 border-t border-slate-900/80 pt-3 flex items-center justify-between text-[10px] font-mono text-slate-400" id="original-preview-footer">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0 animate-ping" />
                  引擎就绪
                </span>
                <span className="text-[11px] text-slate-500">GPU 资源: <span className="text-[#a78bfa] font-bold">充裕</span></span>
              </div>
              <div className="text-[11px] text-slate-500">
                当前已选择: <span className="text-white font-bold">{originalCount}张</span>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

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
import { ProductSubTab, ImportBatch, TaskRecord, StoredImageRecord } from '../types';
import type { RendererTaskService } from '../features/tasks/taskService';
import ImageUploader from './ImageUploader';
import GenerationResult from './GenerationResult';

interface ProductProcessingProps {
  taskService: RendererTaskService;
}

export default function ProductProcessing({ taskService }: ProductProcessingProps) {
  const [subTab, setSubTab] = useState<ProductSubTab>('remove');
  
  // Simulated loading state for parameters
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStepText, setCurrentStepText] = useState('');
  const [progress, setProgress] = useState(0);

  // TAB 1: REMOVE PRODUCT state
  const [removeBatch, setRemoveBatch] = useState<ImportBatch | null>(null);
  const [removeDesc, setRemoveDesc] = useState('');
  const [removeStatus, setRemoveStatus] = useState<'idle' | 'ready' | 'done'>('ready');
  const [removeResult, setRemoveResult] = useState<string | null>(null);

  // TAB 2: REPLACE PRODUCT state
  const [replaceSceneBatch, setReplaceSceneBatch] = useState<ImportBatch | null>(null);
  const [replaceProductBatch, setReplaceProductBatch] = useState<ImportBatch | null>(null);
  const [replaceDesc, setReplaceDesc] = useState('');
  const [replaceStatus, setReplaceStatus] = useState<'idle' | 'ready' | 'done'>('ready');
  const [replaceResult, setReplaceResult] = useState<string | null>(null);

  // TAB 3: REPLACE LOGO state
  const [logoSourceBatch, setLogoSourceBatch] = useState<ImportBatch | null>(null);
  const [logoTargetBatch, setLogoTargetBatch] = useState<ImportBatch | null>(null);
  const [logoDesc, setLogoDesc] = useState('');
  const [logoStatus, setLogoStatus] = useState<'idle' | 'ready' | 'done'>('ready');

  // TAB 4: THEME VARIATION state
  const [themeRefBatch, setThemeRefBatch] = useState<ImportBatch | null>(null);
  const [themePrompt, setThemePrompt] = useState('');
  const [themeCount, setThemeCount] = useState<number>(4);
  const [themeResults, setThemeResults] = useState<string[]>([]);

  // TAB 5: SCENE CONFIG state
  const [sceneDesc, setSceneDesc] = useState('');
  const [sceneRefBatch, setSceneRefBatch] = useState<ImportBatch | null>(null);
  const [sceneCount, setSceneCount] = useState<number>(2);
  const [sceneResults, setSceneResults] = useState<any[]>([]);

  // Cosmetic Product SVGs to simulate premium output
  const perfumeSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%"><rect width="400" height="400" fill="%23100e16" rx="16"/><defs><linearGradient id="pgrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="%23db2777"/><stop offset="100%" stop-color="%234c1d95"/></linearGradient></defs><g transform="translate(140, 100)"><rect x="30" y="0" width="60" height="25" rx="5" fill="%234b5563" stroke="%239ca3af" stroke-width="2"/><line x1="10" y1="25" x2="110" y2="25" stroke="gold" stroke-width="6" stroke-linecap="round"/><rect x="0" y="30" width="120" height="150" rx="20" fill="url(%23pgrad)" stroke="rgba(255,255,255,0.1)" stroke-width="2"/><circle cx="60" cy="100" r="35" fill="none" stroke="gold" stroke-width="2" stroke-dasharray="3 3"/><text x="25" y="105" font-family="sans-serif" font-size="13" font-weight="bold" fill="white" letter-spacing="1">AMBITION</text></g><rect x="60" y="270" width="280" height="50" fill="%231e1b21" rx="8" stroke="%233730a3" stroke-width="1.5"/><ellipse cx="200" cy="270" rx="150" ry="20" fill="%23110e16"/><text x="145" y="300" font-family="monospace" font-size="12" fill="%23a78bfa">STUDIO RUN: #7280</text></svg>`;

  const skincareCreamSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%"><rect width="400" height="400" fill="%230c0c10" rx="16"/><defs><linearGradient id="cgrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2306b6d4"/><stop offset="100%" stop-color="%231e1b4b"/></linearGradient></defs><path d="M100,280 Q200,290 300,280 L290,160 Q200,170 110,160 Z" fill="url(%23cgrad)" stroke="%2322d3ee" stroke-width="2"/><ellipse cx="200" cy="160" rx="90" ry="15" fill="%230e7490" stroke="%2322d3ee" stroke-width="2"/><ellipse cx="200" cy="151" rx="95" ry="15" fill="%230891b2" stroke="%2322d3ee" stroke-width="2"/><rect x="120" y="195" width="160" height="45" rx="5" fill="%23083344" fill-opacity="0.8" stroke="%2322d3ee" stroke-width="1"/><text x="160" y="222" font-family="sans-serif" font-size="12" font-weight="bold" fill="white">EPIDERMIC</text><path d="M50,280 L350,280 L320,330 L80,330 Z" fill="%231f2937" opacity="0.8"/><text x="165" y="310" font-family="sans-serif" font-size="11" fill="%239ca3af">4K RES: PREMIUM</text></svg>`;

  const waterBottleSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%"><rect width="400" height="400" fill="%2309090e" rx="16"/><rect x="150" y="80" width="100%" height="220" rx="50" fill="%231e1b4b" stroke="%23ec4899" stroke-width="4"/><rect x="180" y="50" width="40" height="30" rx="5" fill="%23ec4899"/><path d="M190,50 L210,50 L200,30 Z" fill="%23a855f7"/><rect x="160" y="240" width="80" height="4" rx="2" fill="%2338bdf8"/><text x="168" y="180" font-family="sans-serif" font-size="18" font-weight="bold" fill="%2338bdf8">AURA</text><text x="168" y="205" font-family="sans-serif" font-size="10" font-weight="medium" fill="white" letter-spacing="2">HYDRATE</text></svg>`;

  const headphoneSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%"><rect width="400" height="400" fill="%230b0a0f" rx="16"/><circle cx="200" cy="180" r="100" fill="none" stroke="%23a78bfa" stroke-width="20" stroke-dasharray="180 180" stroke-linecap="round" transform="rotate(-180 200 180)"/><rect x="90" y="150" width="45" height="90" rx="20" fill="%231e1b4b" stroke="%23a78bfa" stroke-width="4"/><rect x="265" y="150" width="45" height="90" rx="20" fill="%231e1b4b" stroke="%23a78bfa" stroke-width="4"/><circle cx="112" cy="195" r="12" fill="%23fb7185"/><circle cx="288" cy="195" r="12" fill="%23fb7185"/><text x="165" y="290" font-family="sans-serif" font-size="14" font-weight="bold" fill="white" letter-spacing="4">VEO 3D</text></svg>`;

  const backgroundWoodTableSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%23131018"/><defs><linearGradient id="wgrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="%2378350f"/><stop offset="100%" stop-color="%23451a03"/></linearGradient></defs><rect x="20" y="140" width="360" height="40" rx="10" fill="url(%23wgrad)" stroke="%23d97706" stroke-width="1.5"/><rect x="60" y="180" width="30" height="100" fill="%23451a03"/><rect x="310" y="180" width="30" height="100" fill="%23451a03"/><line x1="0" y1="120" x2="400" y2="120" stroke="rgba(255,255,255,0.05)" stroke-width="2"/><ellipse cx="200" cy="140" rx="180" ry="12" fill="%23451a03" opacity="0.6"/></svg>`;

  const bgNordicLivingRoomSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%231c1921"/><rect x="50" y="40" width="130" height="160" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="2"/><path d="M0,230 L400,230 L360,300 L400,300 Z" fill="%231e293b" opacity="0.4"/><rect x="140" y="210" width="120" height="30" rx="5" fill="%2378350f"/><line x1="260" y1="160" x2="320" y2="280" stroke="emerald" stroke-width="2" opacity="0.4"/></svg>`;

  const runProcessing = async (type: ProductSubTab) => {
    // Input validation guards
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

    const batchMap: Record<string, ImportBatch | null> = {
      remove: removeBatch,
      replace: replaceSceneBatch,
      logo: logoSourceBatch,
      theme: themeRefBatch,
      scene: sceneRefBatch,
    };

    const featureMap: Record<string, string> = {
      remove: '去除产品',
      replace: '替换产品',
      logo: '替换Logo',
      theme: '主图裂变',
      scene: '创作新场景',
    };

    const batch = batchMap[type];
    const featureName = featureMap[type];

    let task: TaskRecord | null = null;
    if (batch) {
      task = await taskService.createTask({
        category: 'product',
        feature: featureName,
        batchId: batch.batchId,
        imports: batch.images,
      });
      await taskService.startTask(task);
    }

    setIsGenerating(true);
    setProgress(0);

    const stages = [
      { text: '⚡ 接入 GPU 工作流信道并初始化图纸...', weight: 20 },
      { text: '📷 运用立体视觉卷积计算进行智能选区...', weight: 50 },
      { text: '🎨 进行超高清像素重排与反光融合绘制...', weight: 80 },
      { text: '✨ 平滑处理微层阴影贴合环境光影...', weight: 95 },
      { text: '📦 数据集封装完成，合并至生成框！', weight: 100 }
    ];

    let stepIndex = 0;
    const interval = setInterval(() => {
      const step = stages[stepIndex];
      if (step) {
        setCurrentStepText(step.text);
        setProgress(step.weight);
        stepIndex++;
      } else {
        clearInterval(interval);
        setIsGenerating(false);

        // Populate mock completed outputs on successful simulated generation
        let outputCount = 0;
        if (type === 'remove') {
          setRemoveResult(backgroundWoodTableSvg);
          setRemoveStatus('done');
          outputCount = 1;
        } else if (type === 'replace') {
          setReplaceResult(perfumeSvg);
          setReplaceStatus('done');
          outputCount = 1;
        } else if (type === 'logo') {
          setLogoStatus('done');
          outputCount = 1;
        } else if (type === 'theme') {
          const results = [perfumeSvg, skincareCreamSvg, waterBottleSvg, headphoneSvg].slice(0, themeCount);
          setThemeResults(results);
          outputCount = results.length;
        } else if (type === 'scene') {
          const results = [
            { id: 1, img: backgroundWoodTableSvg, date: '2023-10-27 14:32', title: '完成' },
            { id: 2, img: bgNordicLivingRoomSvg, date: '2023-10-27 14:32', title: '完成' }
          ].slice(0, sceneCount);
          setSceneResults(results);
          outputCount = results.length;
        }

        if (task) {
          const outputRecords: StoredImageRecord[] = Array.from({ length: outputCount }, (_, i) => ({
            id: `output-${Date.now()}-${i}`,
            fileName: `output-${i}.png`,
            filePath: `outputs/${task!.taskId}/output-${i}.png`,
            fileSize: 0,
            mimeType: 'image/png',
            createdAt: new Date().toISOString(),
          }));
          taskService.completeTask(task!, outputRecords).catch(console.error);
        }
      }
    }, 700);
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
                    placeholder="例如：保持原有的透视和光影，将新Logo放在左上角..."
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
              disabled={isGenerating}
              className={`cursor-pointer w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 shadow-lg ${
                isGenerating 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50' 
                  : 'bg-[#7c3aed] text-white hover:bg-[#8b5cf6] active:scale-[0.98]'
              }`}
            >
              <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? '正在执行产品处理...' : '开始生成'}
            </button>
          </div>

        </div>

        {/* Right Side Rendering Window Area */}
        <div className="flex-1 bg-[#0b0a0e]/40 p-6 flex flex-col justify-between overflow-y-auto" id="product-workspace-preview">
          
          <div className="h-full flex flex-col justify-between">
            
            {/* Real-time simulation loading block when running */}
            {isGenerating && (
              <div className="mb-6 p-4 rounded-xl bg-slate-950/80 border border-violet-500/10 shadow-sm animate-pulse" id="product-progress-overlay">
                <div className="flex items-center justify-between text-xs text-white mb-2 font-mono">
                  <span className="font-sans flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                    {currentStepText}
                  </span>
                  <span className="text-[#a78bfa]">{progress}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
                  <div className="bg-gradient-to-r from-violet-600 to-indigo-500 h-1 transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {/* TAB-BY-TAB RENDERING OF COMPLETED OUTPUT VIEWS */}

            {/* Sub-Tab 1: 去除产品 (Remove Product) */}
            {subTab === 'remove' && (
              <GenerationResult
                mode="single"
                state={removeResult ? 'completed' : 'empty'}
                results={removeResult ? [{ id: 'remove-0', imageUrl: removeResult, badge: 'Completed', taskId: 'TSK-8820: REMOVE COMPLETED' }] : []}
                emptyDescription="请在左侧上传待处理的原图并设置相应参数。AI 将自动识别并完美去除指定目标。"
              />
            )}

            {/* Sub-Tab 2: 替换产品 (Replace Product) */}
            {subTab === 'replace' && (
              <GenerationResult
                mode="single"
                state={replaceResult ? 'completed' : 'empty'}
                results={replaceResult ? [{ id: 'replace-0', imageUrl: replaceResult, badge: 'COMPLETED-SYNTH' }] : []}
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
                  
                  {logoStatus === 'done' ? (
                    <div className="w-full max-w-sm aspect-square bg-[#100e16] border border-slate-800 rounded-xl flex items-center justify-center relative animate-fadeIn shadow-lg">
                      <img src={perfumeSvg} className="max-h-full max-w-full" alt="Logo Result" />
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
                state={themeResults.length > 0 ? 'completed' : 'completed'}
                results={(themeResults.length > 0 ? themeResults : [perfumeSvg, skincareCreamSvg, waterBottleSvg, headphoneSvg]).map((svg, i) => ({
                  id: `theme-${i}`,
                  imageUrl: svg,
                }))}
                count={themeResults.length || 4}
                showCount
              />
            )}

            {/* Sub-Tab 5: 创作新场景 (Create New Scene) */}
            {subTab === 'scene' && (
              <GenerationResult
                mode="multi"
                state="completed"
                results={(sceneResults.length > 0 ? sceneResults : [
                  { id: 1, img: backgroundWoodTableSvg, date: '2023-10-27 14:32', title: 'Completed' },
                  { id: 2, img: bgNordicLivingRoomSvg, date: '2023-10-27 14:32', title: 'Completed' }
                ]).map((card) => ({
                  id: `scene-${card.id}`,
                  imageUrl: card.img,
                  badge: card.title,
                }))}
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

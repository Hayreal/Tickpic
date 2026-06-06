import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Eye,
  EyeOff,
  Save,
  Wifi,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import type { AppSettings, RendererAppSettings } from '../shared/domain/settings';
import { KEEP_EXISTING_API_KEY } from '../shared/domain/settings';
import type { ImageModelProtocol } from '../shared/domain/imageFeatureApi';
import { useDesktopClient } from '../hooks/useDesktopClient';

const MODEL_OPTIONS: { id: string; protocol: ImageModelProtocol; label: string }[] = [
  { id: 'gemini-2.5-flash-image', protocol: 'gemini', label: 'Gemini 2.5 Flash Image' },
  { id: 'gpt-image-2', protocol: 'openai', label: 'GPT Image 2' },
  { id: 'gpt-5.4-mini', protocol: 'openai', label: 'GPT 5.4 Mini' },
  { id: 'gemini-3.1-flash-lite', protocol: 'gemini', label: 'Gemini 3.1 Flash Lite' },
  { id: 'gemini-3.1-flash-image-preview', protocol: 'gemini', label: 'Gemini 3.1 Flash Image Preview' },
];

export default function Settings() {
  const desktopClient = useDesktopClient();

  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyPreview, setApiKeyPreview] = useState('');
  const [showKey, setShowKey] = useState(false);

  const [generationModel, setGenerationModel] = useState('gpt-image-2');
  const [workspaceDir, setWorkspaceDir] = useState('');
  const [defaultCount, setDefaultCount] = useState(4);
  const [maxCount, setMaxCount] = useState(8);
  const [maxConcurrentTasks, setMaxConcurrentTasks] = useState(5);

  const [testState, setTestState] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (!desktopClient) return;
    desktopClient.settings.get().then((settings: RendererAppSettings) => {
      setBaseUrl(settings.baseUrl);
      setHasApiKey(settings.hasApiKey);
      setApiKeyPreview(settings.apiKeyPreview ?? '');
      setGenerationModel(settings.defaultModels.generation);
      setWorkspaceDir(settings.workspaceDir);
      setDefaultCount(settings.defaultCount);
      setMaxCount(settings.maxCount);
      setMaxConcurrentTasks(settings.maxConcurrentTasks);
    }).catch(console.error);
  }, [desktopClient]);

  const handleSave = async () => {
    if (!desktopClient) return;
    setSaveMessage('');

    const modelProtocols: Record<string, ImageModelProtocol> = {};
    MODEL_OPTIONS.forEach((m) => {
      modelProtocols[m.id] = m.protocol;
    });

    const settings: AppSettings = {
      schemaVersion: 1,
      n1nApiKey: apiKeyInput || (hasApiKey ? KEEP_EXISTING_API_KEY : ''),
      baseUrl,
      workspaceDir,
      defaultModels: {
        generation: generationModel,
      },
      modelProtocols,
      defaultCount,
      maxCount,
      maxConcurrentTasks,
    };

    try {
      await desktopClient.settings.save(settings);
      setSaveMessage('success');
      setApiKeyInput('');
      const updated = await desktopClient.settings.get();
      setHasApiKey(updated.hasApiKey);
      setApiKeyPreview(updated.apiKeyPreview ?? '');
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handleTestConnection = async () => {
    if (!desktopClient) return;
    setTestState('testing');
    setTestMessage('');
    try {
      const result = await desktopClient.settings.testConnection();
      setTestState(result.success ? 'success' : 'failed');
      setTestMessage(result.message);
    } catch (err) {
      setTestState('failed');
      setTestMessage(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  if (!desktopClient) {
    return (
      <div className="flex-1 bg-[#111015] p-6 flex items-center justify-center">
        <p className="text-slate-500 text-sm">需要 Electron 环境才能使用设置功能</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#111015] p-6 md:p-8 flex flex-col overflow-y-auto select-none" id="settings-tab-viewport">

      {/* Settings Title Section */}
      <div className="mb-6 flex flex-col gap-1.5" id="settings-header">
        <h2 className="text-xl font-sans font-bold text-white flex items-center gap-2">
          设置
        </h2>
        <p className="text-[12px] text-slate-500 font-sans tracking-wide">
          配置您的工作区和 AI 模型集成。
        </p>
      </div>

      {/* Main Configurations Container Card */}
      <div className="w-full max-w-3xl bg-[#0c0b10]/40 rounded-xl border border-slate-900/80 p-6 space-y-6" id="settings-card">

        {/* Model header bar */}
        <div className="flex items-center gap-3 pb-3 border-b border-slate-900" id="settings-card-head">
          <div className="w-8 h-8 rounded-lg bg-violet-950/10 border border-violet-500/10 flex items-center justify-center text-[#a78bfa]">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest leading-none">AI 模型配置</h3>
            <p className="text-[10px] text-slate-500 font-sans mt-1">设置您的 API 令牌和主机网关端点</p>
          </div>
        </div>

        {/* Input Parameters Fields */}
        <div className="space-y-5" id="settings-fields">

          {/* API KEY Input field with Toggle Eye icon */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">模型 API 密钥</label>
              <span className="text-[10px] text-slate-500 font-mono">Bearer Auth Token</span>
            </div>

            {hasApiKey && !showKey && (
              <p className="text-[11px] text-emerald-400 font-mono">已保存密钥: {apiKeyPreview}</p>
            )}

            <div className="relative flex items-center">
              <input
                id="settings-apikey-input"
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={hasApiKey ? '输入新密钥以替换现有密钥...' : '请输入您的 API Key...'}
                className="w-full bg-slate-950/80 rounded-xl border border-slate-850 focus:border-violet-500 focus:outline-none p-3.5 pr-12 text-xs text-white placeholder-slate-600 tracking-wide transition-colors font-mono"
              />
              <button
                id="toggle-apikey-visibility"
                onClick={() => setShowKey(!showKey)}
                className="cursor-pointer absolute right-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                title={showKey ? '模糊隐藏' : '明文显示'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
              {hasApiKey ? '留空则保留现有密钥，输入新值将替换。' : '安全存放您的 API 密钥以用于身份验证。'}
            </p>
          </div>

          {/* Base URL Input Parameter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">基础 URL</label>
              <span className="text-[10px] text-slate-500 font-mono">Gateway API Host</span>
            </div>
            <input
              id="settings-baseurl-input"
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="例如 https://api.openai.com/v1"
              className="w-full bg-slate-950/80 rounded-xl border border-slate-850 focus:border-violet-500 focus:outline-none p-3.5 text-xs text-white placeholder-slate-600 transition-colors font-mono"
            />
            <p className="text-[11px] text-slate-500 font-sans leading-relaxed">目标后端网关地址，用于向 AI 服务器发出路由请求。</p>
          </div>

          {/* Generation Model Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">生成模型</label>
            <input
              id="settings-generation-model"
              type="text"
              value={generationModel}
              onChange={(e) => setGenerationModel(e.target.value)}
              placeholder="输入模型 ID..."
              className="w-full bg-slate-950/80 rounded-xl border border-slate-850 focus:border-violet-500 focus:outline-none p-3.5 text-xs text-white placeholder-slate-600 transition-colors font-mono"
            />
            <p className="text-[11px] text-slate-500 font-sans">纯图片生成任务使用的模型。</p>
          </div>

        </div>

        {/* Action Controls panel */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-900" id="settings-actions">

          {/* Test connection CTA */}
          <button
            id="test-api-connection"
            onClick={handleTestConnection}
            disabled={testState === 'testing'}
            className={`cursor-pointer px-5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all text-slate-300 border border-slate-850 hover:bg-slate-900/60 ${testState === 'testing' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {testState === 'testing' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                正在连通测试...
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-[#a78bfa]" />
                测试连接
              </>
            )}
          </button>

          {/* Confirm Save Config button */}
          <button
            id="save-api-config"
            onClick={handleSave}
            className="cursor-pointer bg-[#7c3aed] hover:bg-[#8b5cf6] text-white px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-all active:scale-[0.98]"
          >
            <Save className="w-3.5 h-3.5" />
            保存配置
          </button>

        </div>

        {/* Save status messages */}
        {saveMessage === 'success' && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
            <div>
              <p className="font-bold leading-none">配置已保存</p>
              <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">设置已成功写入本地加密存储。</p>
            </div>
          </div>
        )}
        {saveMessage && saveMessage !== 'success' && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex gap-2 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div>
              <p className="font-bold leading-none">保存失败</p>
              <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">{saveMessage}</p>
            </div>
          </div>
        )}

        {/* Testing status alert banners */}
        {testState === 'success' && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex gap-2 animate-fadeIn" id="test-alert-success">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
            <div>
              <p className="font-bold leading-none">测试连接成功！</p>
              <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">{testMessage}</p>
            </div>
          </div>
        )}

        {testState === 'failed' && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex gap-2 animate-fadeIn" id="test-alert-failed">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div>
              <p className="font-bold leading-none">握手测试失败</p>
              <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">{testMessage}</p>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}

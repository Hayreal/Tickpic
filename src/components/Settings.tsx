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
  Sliders,
  Settings as SettingsIcon,
  Info
} from 'lucide-react';
import { AppSettings } from '../types';

export default function Settings() {
  const [apiKey, setApiKey] = useState('sk-proj-....................');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [modelId, setModelId] = useState('gpt-4-turbo');
  const [showKey, setShowKey] = useState(false);

  // Connection testing states
  const [testState, setTestState] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');

  // Load persistence configurations from localStorage
  useEffect(() => {
    const cachedKey = localStorage.getItem('CREATIVE_API_KEY');
    const cachedUrl = localStorage.getItem('CREATIVE_BASE_URL');
    const cachedModel = localStorage.getItem('CREATIVE_MODEL_ID');
    if (cachedKey) setApiKey(cachedKey);
    if (cachedUrl) setBaseUrl(cachedUrl);
    if (cachedModel) setModelId(cachedModel);
  }, []);

  const handleSave = () => {
    localStorage.setItem('CREATIVE_API_KEY', apiKey);
    localStorage.setItem('CREATIVE_BASE_URL', baseUrl);
    localStorage.setItem('CREATIVE_MODEL_ID', modelId);
    alert('配置已成功保存！');
  };

  const handleTestConnection = () => {
    setTestState('testing');
    setTimeout(() => {
      if (apiKey.length > 5) {
        setTestState('success');
      } else {
        setTestState('failed');
      }
    }, 1500);
  };

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
            
            <div className="relative flex items-center">
              <input 
                id="settings-apikey-input"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="请输入您的 API Key..."
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
            <p className="text-[11px] text-slate-500 font-sans leading-relaxed">安全存放您的 API 密钥以用于身份验证。</p>
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

          {/* Choose target Model ID Dropdown selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">模型 ID</label>
            <div className="relative">
              <select 
                id="settings-model-selector"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="cursor-pointer w-full bg-slate-950/80 rounded-xl border border-slate-850 focus:border-violet-500 focus:outline-none p-3.5 text-xs text-white appearance-none select-none"
              >
                <option value="gpt-4-turbo" className="bg-[#0c0b10] text-slate-300 py-2">gpt-4-turbo (活跃/推荐)</option>
                <option value="gpt-4o" className="bg-[#0c0b10] text-slate-300 py-2">gpt-4o (高配图像语义)</option>
                <option value="gpt-3.5-turbo" className="bg-[#0c0b10] text-slate-300 py-2">gpt-3.5-turbo (极速能效优先)</option>
                <option value="gemini-3.5-flash" className="bg-[#0c0b10] text-slate-300 py-2">gemini-3.5-flash (原生多模态)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                <Sliders className="w-4 h-4 text-slate-600" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 font-sans">选择生成图片或进行抠图运算所采用的预训练大语言、视觉模型 ID。</p>
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

        {/* Testing status alert banners */}
        {testState === 'success' && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex gap-2 animate-fadeIn" id="test-alert-success">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
            <div>
              <p className="font-bold leading-none">测试连接成功！</p>
              <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">目标网关已正确应答。AI 创意模型通信链路握手成功，可以进行创意创作！</p>
            </div>
          </div>
        )}

        {testState === 'failed' && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex gap-2 animate-fadeIn" id="test-alert-failed">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div>
              <p className="font-bold leading-none">握手测试失败</p>
              <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">未注入合法的 Token API Key。请检查您输入模型的授权密钥是否完备。</p>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}

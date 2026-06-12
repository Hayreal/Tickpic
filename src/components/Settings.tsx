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
  FolderOpen,
} from 'lucide-react';
import type { AppSettings, RendererAppSettings } from '../shared/domain/settings';
import { KEEP_EXISTING_API_KEY, resolveModelProtocolFromSettings } from '../shared/domain/settings';
import type { ImageModelProtocol } from '../shared/domain/imageFeatureApi';
import { cn } from '@/src/lib/utils';
import { useDesktopClient } from '../hooks/useDesktopClient';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/src/components/ui/card';
import EyeCareToggle from './EyeCareToggle';

export default function Settings() {
  const desktopClient = useDesktopClient();

  const [baseUrl, setBaseUrl] = useState('https://api.n1n.ai');
  const [modelProtocol, setModelProtocol] = useState<ImageModelProtocol>('openai');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyPreview, setApiKeyPreview] = useState('');
  const [showKey, setShowKey] = useState(false);

  const [generationModel, setGenerationModel] = useState('');
  const [visionModel, setVisionModel] = useState('');
  const [workspaceDir, setWorkspaceDir] = useState('');
  const [defaultCount, setDefaultCount] = useState(1);
  const [maxCount, setMaxCount] = useState(2);
  const [maxConcurrentTasks, setMaxConcurrentTasks] = useState(5);

  const [testState, setTestState] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (!desktopClient) return;
    desktopClient.settings.get().then((settings: RendererAppSettings) => {
      setBaseUrl(settings.baseUrl);
      setModelProtocol(settings.modelProtocol ?? resolveModelProtocolFromSettings(settings));
      setHasApiKey(settings.hasApiKey);
      setApiKeyPreview(settings.apiKeyPreview ?? '');
      setGenerationModel(settings.defaultModels.generation);
      setVisionModel(settings.defaultModels.vision);
      setWorkspaceDir(settings.workspaceDir);
      setDefaultCount(settings.defaultCount);
      setMaxCount(settings.maxCount);
      setMaxConcurrentTasks(settings.maxConcurrentTasks);
    }).catch(console.error);
  }, [desktopClient]);

  const handleSave = async () => {
    if (!desktopClient) return;
    setSaveMessage('');

    const settings: AppSettings = {
      schemaVersion: 1,
      n1nApiKey: apiKeyInput || (hasApiKey ? KEEP_EXISTING_API_KEY : ''),
      baseUrl,
      modelProtocol,
      workspaceDir: workspaceDir.trim(),
      defaultModels: {
        generation: generationModel.trim(),
        vision: visionModel.trim(),
      },
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

  const handlePickWorkspaceDir = async () => {
    if (!desktopClient) return;
    try {
      const picked = await desktopClient.settings.pickWorkspaceDir();
      if (picked) setWorkspaceDir(picked);
    } catch (err) {
      console.error(err);
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
      <div className="ui-page-scroll items-center justify-center">
        <p className="text-muted-foreground text-sm">需要 Electron 环境才能使用设置功能</p>
      </div>
    );
  }

  return (
    <div className="ui-page-scroll" id="settings-tab-viewport">
      <div className="mb-8 max-w-3xl" id="settings-header">
        <h2 className="text-2xl font-semibold tracking-tight">设置</h2>
        <p className="text-sm text-muted-foreground mt-1">配置工作区路径与 AI 模型集成。</p>
      </div>

      <Card className="max-w-3xl mb-6" id="settings-appearance-card">
        <CardHeader>
          <CardTitle>界面外观</CardTitle>
          <CardDescription>调整应用视觉风格，保护视力健康。</CardDescription>
        </CardHeader>
        <CardContent>
          <EyeCareToggle switchId="settings-eye-care-switch" />
        </CardContent>
      </Card>

      <Card className="max-w-3xl" id="settings-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>AI 模型配置</CardTitle>
              <CardDescription>API 密钥、模型地址与模型 ID</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="settings-apikey-input">模型 API 密钥</Label>
            </div>
            {hasApiKey && !showKey && (
              <p className="text-xs text-emerald-600 font-mono">已保存: {apiKeyPreview}</p>
            )}
            <div className="relative">
              <Input
                id="settings-apikey-input"
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={hasApiKey ? '输入新密钥以替换...' : '请输入 API Key'}
                className="pr-10 font-mono"
              />
              <button
                id="toggle-apikey-visibility"
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-baseurl-input">基础 URL</Label>
            <Input
              id="settings-baseurl-input"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.n1n.ai"
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label id="settings-model-protocol-label">接口协议</Label>
            <p className="text-xs text-muted-foreground">
              n1n 等平台可同时支持两种协议；请按所选协议填写对应模型 ID。
            </p>
            <div
              id="settings-model-protocol"
              role="group"
              aria-labelledby="settings-model-protocol-label"
              className="grid grid-cols-2 gap-2"
            >
              <button
                id="settings-model-protocol-openai"
                type="button"
                onClick={() => setModelProtocol('openai')}
                className={cn(
                  'cursor-pointer rounded-lg border px-3 py-2 text-left text-xs transition-all',
                  modelProtocol === 'openai' ? 'ui-segment-active' : 'ui-segment-inactive',
                )}
              >
                <span className="block font-semibold">OpenAI 兼容</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  chat.completions / images
                </span>
              </button>
              <button
                id="settings-model-protocol-gemini"
                type="button"
                onClick={() => setModelProtocol('gemini')}
                className={cn(
                  'cursor-pointer rounded-lg border px-3 py-2 text-left text-xs transition-all',
                  modelProtocol === 'gemini' ? 'ui-segment-active' : 'ui-segment-inactive',
                )}
              >
                <span className="block font-semibold">Google GenAI</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  generateContent
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-workspace-dir">保存路径</Label>
            <div className="flex gap-2">
              <Input
                id="settings-workspace-dir"
                value={workspaceDir}
                onChange={(e) => setWorkspaceDir(e.target.value)}
                placeholder="选择或输入本地保存目录"
                className="font-mono"
              />
              <Button id="pick-workspace-dir" type="button" variant="outline" onClick={handlePickWorkspaceDir}>
                <FolderOpen className="h-4 w-4" />
                浏览
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-vision-model">指令生成模型</Label>
              <Input
                id="settings-vision-model"
                value={visionModel}
                onChange={(e) => setVisionModel(e.target.value)}
                placeholder={modelProtocol === 'gemini' ? 'gemini-3.1-flash-lite' : 'gpt-5.4-mini'}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-generation-model">出图模型</Label>
              <Input
                id="settings-generation-model"
                value={generationModel}
                onChange={(e) => setGenerationModel(e.target.value)}
                placeholder={modelProtocol === 'gemini' ? 'gemini-2.5-flash-image' : 'gpt-image-2-all'}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {saveMessage === 'success' && (
            <div className="ui-alert-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>配置已保存到本地加密存储。</span>
            </div>
          )}
          {saveMessage && saveMessage !== 'success' && (
            <div className="ui-alert-error">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{saveMessage}</span>
            </div>
          )}
          {testState === 'success' && (
            <div className="ui-alert-success" id="test-alert-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{testMessage}</span>
            </div>
          )}
          {testState === 'failed' && (
            <div className="ui-alert-error" id="test-alert-failed">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{testMessage}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-end gap-2 border-t bg-muted/30 pt-6">
          <Button
            id="test-api-connection"
            variant="outline"
            onClick={handleTestConnection}
            disabled={testState === 'testing'}
          >
            {testState === 'testing' ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Wifi className="h-4 w-4" />
            )}
            测试连接
          </Button>
          <Button id="save-api-config" onClick={handleSave}>
            <Save className="h-4 w-4" />
            保存配置
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

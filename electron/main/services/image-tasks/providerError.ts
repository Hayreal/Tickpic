export interface NormalizedImageTaskError {
  code: string;
  message: string;
}

export function normalizeImageTaskError(error: unknown): NormalizedImageTaskError {
  const status = readStatus(error);
  const rawMessage = error instanceof Error ? error.message : String(error);
  const rayId = extractCloudflareRayId(rawMessage);

  if (status === 403 && rayId) {
    return {
      code: 'image_provider_cloudflare_blocked',
      message: `图片服务拒绝了请求（HTTP 403）。上游服务的 Cloudflare 安全策略拦截了当前访问。请检查 API Key、模型权限或出口网络。Ray ID: ${rayId}`,
    };
  }

  if (status === 401) {
    return {
      code: 'image_provider_unauthorized',
      message: '图片服务认证失败（HTTP 401）。请检查 API Key。',
    };
  }

  if (status === 403) {
    return {
      code: 'image_provider_forbidden',
      message: `图片服务拒绝了请求（HTTP 403）。请检查 API Key、模型权限或账户访问策略。`,
    };
  }

  return {
    code: 'image_task_failed',
    message: cleanProviderErrorMessage(rawMessage, status),
  };
}

function readStatus(error: unknown) {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }

  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/\bHTTP\s+(\d{3})\b|\b(\d{3})\s+<(!DOCTYPE|html)/i);
  return Number(match?.[1] ?? match?.[2]) || undefined;
}

function extractCloudflareRayId(message: string) {
  return message.match(/Cloudflare Ray ID:\s*<strong[^>]*>([^<]+)<\/strong>/i)?.[1]?.trim()
    ?? message.match(/Cloudflare Ray ID:\s*([a-f0-9]+)/i)?.[1]?.trim();
}

function cleanProviderErrorMessage(message: string, status?: number) {
  const title = message.match(/<title>\s*([^<]+?)\s*<\/title>/i)?.[1]?.trim();
  if (title) {
    return status ? `图片服务请求失败（HTTP ${status}）：${title}` : `图片服务请求失败：${title}`;
  }

  const singleLine = message.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= 500) return singleLine;
  return `${singleLine.slice(0, 497)}...`;
}

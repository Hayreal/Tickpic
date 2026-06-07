export function sanitizeForLog(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    if (value.startsWith('data:') && value.includes(';base64,')) {
      return '[base64 redacted]';
    }
    if (/^sk-[A-Za-z0-9_-]{8,}/.test(value)) {
      return '[api-key redacted]';
    }
    if (value.length > 512 && /^[A-Za-z0-9+/=]+$/.test(value)) {
      return '[base64 redacted]';
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (
      (key === 'apiKey' || key === 'n1nApiKey' || key === 'authorization' || key === 'Authorization')
      && typeof nestedValue === 'string'
    ) {
      sanitized[key] = '[secret redacted]';
      continue;
    }
    if (key === 'data' && typeof nestedValue === 'string' && nestedValue.length > 64) {
      sanitized[key] = '[base64 redacted]';
      continue;
    }
    if (key === 'inlineData' && isRecord(nestedValue)) {
      sanitized[key] = {
        ...nestedValue,
        data: '[base64 redacted]',
      };
      continue;
    }
    if (key === 'image_url' && isRecord(nestedValue) && typeof nestedValue.url === 'string') {
      sanitized[key] = {
        ...nestedValue,
        url: sanitizeForLog(nestedValue.url),
      };
      continue;
    }
    sanitized[key] = sanitizeForLog(nestedValue);
  }

  return sanitized;
}

export function formatLogDetails(details: unknown): string | undefined {
  if (details === undefined) {
    return undefined;
  }

  if (typeof details === 'string') {
    return details;
  }

  try {
    return JSON.stringify(sanitizeForLog(details), null, 2);
  } catch {
    return String(details);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

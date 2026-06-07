import { getAppLogger } from '../logger/appLogger.js';
import { sanitizeForLog } from '../logger/sanitizeLog.js';

type LogStage = 'instruction' | 'execution';

export function logModelRequest(stage: LogStage, payload: unknown) {
  const url = extractRequestUrl(payload);
  const logger = getAppLogger();

  if (url) {
    logger.info('model', `模型请求 (${stage})`, { url });
  } else {
    logger.info('model', `模型请求 (${stage})`, sanitizeForLog(payload));
  }
}

function extractRequestUrl(payload: unknown) {
  if (!isRecord(payload) || typeof payload.url !== 'string') {
    return undefined;
  }
  return payload.url;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

import { getAppLogger } from '../logger/appLogger.js';
import { sanitizeForLog } from '../logger/sanitizeLog.js';

type LogStage = 'instruction' | 'execution';

export function logModelRequest(stage: LogStage, payload: unknown) {
  getAppLogger().info('model', `模型请求 (${stage})`, sanitizeForLog(payload));
}

export function logModelResponse(stage: LogStage, payload: unknown) {
  getAppLogger().info('model', `模型响应 (${stage})`, sanitizeForLog(payload));
}

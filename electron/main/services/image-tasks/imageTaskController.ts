import type {
  ImageTaskRecord,
  ImageTaskResult,
  ImageTaskRequest,
  ImageTaskSubmitResult,
} from '../../../../src/shared/domain/imageFeatureApi.js';
import { validateImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import { getAppLogger } from '../logger/appLogger.js';
import { normalizeImageTaskError } from './providerError.js';

export type ImageTaskStatusListener = (task: ImageTaskRecord) => void;

export type ImageTaskProgressUpdate = Partial<
  Pick<
    ImageTaskExecutionResult,
    | 'images'
    | 'progress'
    | 'outputDir'
    | 'requestJsonPath'
    | 'imageInstructionPath'
    | 'outputJsonPath'
    | 'textNotes'
    | 'warnings'
  >
>;

export type ImageTaskProgressReporter = (update: ImageTaskProgressUpdate) => void;

export type ImageTaskExecutor = (
  task: ImageTaskRecord,
  abortSignal: AbortSignal,
  onProgress?: ImageTaskProgressReporter,
) => Promise<ImageTaskExecutionResult>;

export type ImageTaskExecutionResult = Pick<
  ImageTaskResult,
  | 'model'
  | 'protocol'
  | 'outputDir'
  | 'images'
  | 'progress'
  | 'requestJsonPath'
  | 'imageInstructionPath'
  | 'outputJsonPath'
  | 'textNotes'
  | 'warnings'
>;

export interface ImageTaskControllerOptions {
  execute?: ImageTaskExecutor;
  maxConcurrency?: number;
}

export interface ImageTaskController {
  submit(request: ImageTaskRequest): ImageTaskSubmitResult;
  cancel(taskId: string): ImageTaskRecord;
  get(taskId: string): ImageTaskRecord | undefined;
  list(): ImageTaskRecord[];
  onStatus(listener: ImageTaskStatusListener): () => void;
  failAllActive(message: string): void;
}

export function createImageTaskController(options: ImageTaskControllerOptions = {}): ImageTaskController {
  const logger = getAppLogger();
  const tasks = new Map<string, ImageTaskRecord>();
  const listeners = new Set<ImageTaskStatusListener>();
  const queue: string[] = [];
  const abortControllers = new Map<string, AbortController>();
  const maxConcurrency = options.maxConcurrency ?? 5;
  let runningCount = 0;

  function emit(task: ImageTaskRecord) {
    for (const listener of listeners) {
      listener(task);
    }
  }

  function updateTask(task: ImageTaskRecord) {
    tasks.set(task.taskId, task);
    emit(task);
  }

  function pumpQueue() {
    if (!options.execute) return;

    while (runningCount < maxConcurrency && queue.length > 0) {
      const taskId = queue.shift();
      if (!taskId) return;

      const task = tasks.get(taskId);
      if (!task || task.status !== 'queued') continue;

      runningCount += 1;
      const abortController = new AbortController();
      abortControllers.set(task.taskId, abortController);
      void runTask(task, abortController.signal);
    }
  }

  function reportProgress(taskId: string, update: ImageTaskProgressUpdate) {
    const current = tasks.get(taskId);
    if (!current || current.status !== 'running') return;

    updateTask({
      ...current,
      images: update.images ?? current.images,
      progress: update.progress ?? current.progress,
      outputDir: update.outputDir ?? current.outputDir,
      requestJsonPath: update.requestJsonPath ?? current.requestJsonPath,
      imageInstructionPath: update.imageInstructionPath ?? current.imageInstructionPath,
      outputJsonPath: update.outputJsonPath ?? current.outputJsonPath,
      textNotes: update.textNotes ?? current.textNotes,
      warnings: update.warnings ?? current.warnings,
      updatedAt: new Date().toISOString(),
    });
  }

  async function runTask(task: ImageTaskRecord, abortSignal: AbortSignal) {
    const runningTask: ImageTaskRecord = {
      ...task,
      status: 'running',
      updatedAt: new Date().toISOString(),
    };
    logger.info('image-task', '开始执行任务', {
      taskId: task.taskId,
      feature: task.feature,
    });
    updateTask(runningTask);

    try {
      const result = await options.execute!(
        runningTask,
        abortSignal,
        (update) => reportProgress(task.taskId, update),
      );
      const current = tasks.get(task.taskId);
      if (!current || current.status !== 'running') return;

      logger.info('image-task', '任务执行完成', {
        taskId: task.taskId,
        feature: task.feature,
        outputCount: result.images.length,
        outputDir: result.outputDir,
      });
      updateTask({
        ...current,
        ...result,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const current = tasks.get(task.taskId);
      if (!current || current.status !== 'running') return;

       const normalizedError = normalizeImageTaskError(error);
       logger.error('image-task', '任务执行失败', {
         taskId: task.taskId,
         feature: task.feature,
         code: normalizedError.code,
         message: normalizedError.message,
       });
      updateTask({
        ...current,
        status: 'failed',
        error: {
           code: normalizedError.code,
           message: normalizedError.message,
        },
        updatedAt: new Date().toISOString(),
      });
    } finally {
      abortControllers.delete(task.taskId);
      runningCount -= 1;
      pumpQueue();
    }
  }

  return {
    submit(request) {
      const validated = validateImageTaskRequest(request);
      const now = new Date().toISOString();
      const task: ImageTaskRecord = {
        taskId: createTaskId(),
        feature: validated.feature,
        status: 'queued',
        request: validated,
        images: [],
        createdAt: now,
        updatedAt: now,
      };

      tasks.set(task.taskId, task);
      emit(task);
      queue.push(task.taskId);
      logger.info('image-task', '任务已创建并入队', {
        taskId: task.taskId,
        feature: task.feature,
        queueLength: queue.length,
      });
      pumpQueue();

      return {
        taskId: task.taskId,
        feature: task.feature,
        status: 'queued',
      };
    },

    cancel(taskId) {
      const task = tasks.get(taskId);
      if (!task) {
        throw new Error(`image task ${taskId} not found`);
      }
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'canceled') {
        return task;
      }

      const queuedIndex = queue.indexOf(taskId);
      if (queuedIndex >= 0) {
        queue.splice(queuedIndex, 1);
      }

      const next: ImageTaskRecord = {
        ...task,
        status: 'canceled',
        updatedAt: new Date().toISOString(),
      };
      abortControllers.get(taskId)?.abort();
      logger.info('image-task', '任务已取消', { taskId, feature: task.feature });
      updateTask(next);
      return next;
    },

    get(taskId) {
      return tasks.get(taskId);
    },

    list() {
      return Array.from(tasks.values());
    },

    onStatus(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    failAllActive(message) {
      queue.length = 0;
      logger.warn('image-task', '终止所有活动任务', { message });

      for (const [taskId, task] of tasks) {
        if (task.status !== 'queued' && task.status !== 'running') {
          continue;
        }

        abortControllers.get(taskId)?.abort();
        updateTask({
          ...task,
          status: 'failed',
          error: {
            code: 'app_shutdown',
            message,
          },
          updatedAt: new Date().toISOString(),
        });
      }
    },
  };
}

function createTaskId() {
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

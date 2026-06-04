import type {
  ImageTaskRecord,
  ImageTaskResult,
  ImageTaskRequest,
  ImageTaskSubmitResult,
} from '../../../../src/shared/domain/imageFeatureApi.js';
import { validateImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';

export type ImageTaskStatusListener = (task: ImageTaskRecord) => void;
export type ImageTaskExecutor = (
  task: ImageTaskRecord,
  abortSignal: AbortSignal,
) => Promise<ImageTaskExecutionResult>;

export type ImageTaskExecutionResult = Pick<
  ImageTaskResult,
  | 'model'
  | 'protocol'
  | 'outputDir'
  | 'images'
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
}

export function createImageTaskController(options: ImageTaskControllerOptions = {}): ImageTaskController {
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

  async function runTask(task: ImageTaskRecord, abortSignal: AbortSignal) {
    const runningTask: ImageTaskRecord = {
      ...task,
      status: 'running',
      updatedAt: new Date().toISOString(),
    };
    updateTask(runningTask);

    try {
      const result = await options.execute!(runningTask, abortSignal);
      const current = tasks.get(task.taskId);
      if (!current || current.status !== 'running') return;

      updateTask({
        ...current,
        ...result,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const current = tasks.get(task.taskId);
      if (!current || current.status !== 'running') return;

      updateTask({
        ...current,
        status: 'failed',
        error: {
          code: 'image_task_failed',
          message: error instanceof Error ? error.message : String(error),
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
  };
}

function createTaskId() {
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

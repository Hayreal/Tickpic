import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from 'react';
import type {
  ImageFeature,
  ImageTaskRequest,
  ImageTaskSubmitResult,
  ImageTaskRecord,
} from '../shared/domain/imageFeatureApi';
import { useDesktopClient } from './useDesktopClient';

type TaskMap = Partial<Record<ImageFeature, ImageTaskRecord[]>>;
type ErrorMap = Partial<Record<ImageFeature, string>>;

export interface SubmitManyOptions {
  /** Default batch ID for requests whose outputBatchId is missing or blank. */
  outputBatchId?: string;
  /** Generate one shared batch ID for requests whose outputBatchId is missing or blank. */
  forceOutputBatchId?: boolean;
}

export interface UseImageTaskReturn {
  submit: (request: ImageTaskRequest) => Promise<ImageTaskSubmitResult>;
  submitMany: (requests: ImageTaskRequest[], options?: SubmitManyOptions) => Promise<ImageTaskSubmitResult[]>;
  bindTask: (taskId: string, feature: ImageFeature) => Promise<void>;
  restoreTask: (task: ImageTaskRecord) => void;
  getTask: (feature: ImageFeature) => ImageTaskRecord | null;
  getTasks: (feature: ImageFeature) => ImageTaskRecord[];
  getError: (feature: ImageFeature) => string | null;
  isSubmitting: boolean;
  reset: (feature?: ImageFeature) => void;
}

function applyTaskUpdate(
  task: ImageTaskRecord,
  setTasksByFeature: Dispatch<SetStateAction<TaskMap>>,
  setErrorsByFeature: Dispatch<SetStateAction<ErrorMap>>,
) {
  setTasksByFeature((current) => ({
    ...current,
    [task.feature]: upsertTask(current[task.feature] ?? [], task),
  }));

  if (task.status === 'failed' && task.error) {
    setErrorsByFeature((current) => ({
      ...current,
      [task.feature]: task.error!.message,
    }));
    return;
  }

  if (task.status === 'completed' || task.status === 'canceled') {
    setErrorsByFeature((current) => {
      if (!current[task.feature]) {
        return current;
      }
      const next = { ...current };
      delete next[task.feature];
      return next;
    });
  }
}

function upsertTask(tasks: ImageTaskRecord[], task: ImageTaskRecord) {
  const index = tasks.findIndex((item) => item.taskId === task.taskId);
  if (index === -1) {
    return [...tasks, task];
  }

  const next = [...tasks];
  next[index] = task;
  return next;
}

function assertNoBlobImages(request: ImageTaskRequest) {
  if (request.images?.some((image) => image.path.startsWith('blob:'))) {
    throw new Error('图片尚未保存到本地，请等待上传完成或重新上传');
  }
}

export function useImageTask(): UseImageTaskReturn {
  const desktopClient = useDesktopClient();
  const [tasksByFeature, setTasksByFeature] = useState<TaskMap>({});
  const [errorsByFeature, setErrorsByFeature] = useState<ErrorMap>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeSubmissionCountRef = useRef(0);
  const trackedTaskIdsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!desktopClient) return;

    const unsubscribe = desktopClient.imageTask.onStatus((task: ImageTaskRecord) => {
      if (!mountedRef.current) return;
      if (!trackedTaskIdsRef.current.has(task.taskId)) return;

      applyTaskUpdate(task, setTasksByFeature, setErrorsByFeature);
    });

    return () => {
      unsubscribe();
    };
  }, [desktopClient]);

  const trackTask = useCallback((task: ImageTaskRecord) => {
    trackedTaskIdsRef.current.add(task.taskId);
    applyTaskUpdate(task, setTasksByFeature, setErrorsByFeature);
  }, []);

  const bindTask = useCallback(async (taskId: string, feature: ImageFeature) => {
    if (!desktopClient) {
      return;
    }

    trackedTaskIdsRef.current.add(taskId);
    const task = await desktopClient.imageTask.get(taskId);
    if (!mountedRef.current || !task) {
      return;
    }

    if (task.feature !== feature) {
      return;
    }

    trackTask(task);
  }, [desktopClient, trackTask]);

  const restoreTask = useCallback((task: ImageTaskRecord) => {
    trackTask(task);
  }, [trackTask]);

  const beginSubmission = useCallback(() => {
    activeSubmissionCountRef.current += 1;
    setIsSubmitting(true);
  }, []);

  const endSubmission = useCallback(() => {
    activeSubmissionCountRef.current = Math.max(0, activeSubmissionCountRef.current - 1);
    if (mountedRef.current && activeSubmissionCountRef.current === 0) {
      setIsSubmitting(false);
    }
  }, []);

  const submitOne = useCallback(async (
    request: ImageTaskRequest,
    options: { manageSubmitting?: boolean } = { manageSubmitting: true },
  ): Promise<ImageTaskSubmitResult> => {
    if (!desktopClient) {
      throw new Error('Desktop bridge unavailable');
    }

    setErrorsByFeature((current) => {
      if (!current[request.feature]) {
        return current;
      }
      const next = { ...current };
      delete next[request.feature];
      return next;
    });
    if (options.manageSubmitting !== false) {
      beginSubmission();
    }

    try {
      assertNoBlobImages(request);

      const result = await desktopClient.imageTask.submit(request);
      trackedTaskIdsRef.current.add(result.taskId);

      const task = await desktopClient.imageTask.get(result.taskId);
      if (mountedRef.current && task) {
        trackTask(task);
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Task submission failed';
      setErrorsByFeature((current) => ({
        ...current,
        [request.feature]: message,
      }));
      throw err;
    } finally {
      if (options.manageSubmitting !== false) {
        endSubmission();
      }
    }
  }, [beginSubmission, desktopClient, endSubmission, trackTask]);

  const submit = useCallback((request: ImageTaskRequest) => submitOne(request), [submitOne]);

  const submitMany = useCallback(async (
    requests: ImageTaskRequest[],
    options: SubmitManyOptions = {},
  ): Promise<ImageTaskSubmitResult[]> => {
    if (!desktopClient) {
      throw new Error('Desktop bridge unavailable');
    }

    beginSubmission();
    try {
      requests.forEach(assertNoBlobImages);
      const optionOutputBatchId = options.outputBatchId?.trim() || undefined;
      const outputBatchId = optionOutputBatchId
        ?? (requests.length > 1 || options.forceOutputBatchId ? crypto.randomUUID() : undefined);
      const results: ImageTaskSubmitResult[] = [];
      for (const request of requests) {
        const requestOutputBatchId = request.outputBatchId?.trim();
        const requestWithBatchId = requestOutputBatchId
          ? { ...request, outputBatchId: requestOutputBatchId }
          : outputBatchId
            ? { ...request, outputBatchId }
            : { ...request, outputBatchId: undefined };
        results.push(await submitOne(
          requestWithBatchId,
          { manageSubmitting: false },
        ));
      }
      return results;
    } finally {
      endSubmission();
    }
  }, [beginSubmission, desktopClient, endSubmission, submitOne]);

  const getTasks = useCallback((feature: ImageFeature) => tasksByFeature[feature] ?? [], [tasksByFeature]);

  const getTask = useCallback((feature: ImageFeature) => {
    const tasks = tasksByFeature[feature] ?? [];
    return tasks.at(-1) ?? null;
  }, [tasksByFeature]);

  const getError = useCallback((feature: ImageFeature) => errorsByFeature[feature] ?? null, [errorsByFeature]);

  const reset = useCallback((feature?: ImageFeature) => {
    if (!feature) {
      setTasksByFeature({});
      setErrorsByFeature({});
      trackedTaskIdsRef.current.clear();
      return;
    }

    setTasksByFeature((current) => {
      for (const task of current[feature] ?? []) {
        trackedTaskIdsRef.current.delete(task.taskId);
      }
      const next = { ...current };
      delete next[feature];
      return next;
    });
    setErrorsByFeature((current) => {
      if (!current[feature]) {
        return current;
      }
      const next = { ...current };
      delete next[feature];
      return next;
    });
  }, []);

  return { submit, submitMany, bindTask, restoreTask, getTask, getTasks, getError, isSubmitting, reset };
}

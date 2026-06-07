import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from 'react';
import type {
  ImageFeature,
  ImageTaskRequest,
  ImageTaskSubmitResult,
  ImageTaskRecord,
} from '../shared/domain/imageFeatureApi';
import { useDesktopClient } from './useDesktopClient';

type TaskMap = Partial<Record<ImageFeature, ImageTaskRecord>>;
type ErrorMap = Partial<Record<ImageFeature, string>>;

export interface UseImageTaskReturn {
  submit: (request: ImageTaskRequest) => Promise<ImageTaskSubmitResult>;
  bindTask: (taskId: string, feature: ImageFeature) => Promise<void>;
  restoreTask: (task: ImageTaskRecord) => void;
  getTask: (feature: ImageFeature) => ImageTaskRecord | null;
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
    [task.feature]: task,
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

export function useImageTask(): UseImageTaskReturn {
  const desktopClient = useDesktopClient();
  const [tasksByFeature, setTasksByFeature] = useState<TaskMap>({});
  const [errorsByFeature, setErrorsByFeature] = useState<ErrorMap>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const submit = useCallback(async (request: ImageTaskRequest): Promise<ImageTaskSubmitResult> => {
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
    setIsSubmitting(true);

    try {
      if (request.images?.some((image) => image.path.startsWith('blob:'))) {
        throw new Error('图片尚未保存到本地，请等待上传完成或重新上传');
      }

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
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, [desktopClient, trackTask]);

  const getTask = useCallback((feature: ImageFeature) => tasksByFeature[feature] ?? null, [tasksByFeature]);

  const getError = useCallback((feature: ImageFeature) => errorsByFeature[feature] ?? null, [errorsByFeature]);

  const reset = useCallback((feature?: ImageFeature) => {
    if (!feature) {
      setTasksByFeature({});
      setErrorsByFeature({});
      trackedTaskIdsRef.current.clear();
      setIsSubmitting(false);
      return;
    }

    setTasksByFeature((current) => {
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

  return { submit, bindTask, restoreTask, getTask, getError, isSubmitting, reset };
}

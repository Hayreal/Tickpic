import type { DesktopBridgeApi } from '../../shared/contracts/desktop';

export function createDesktopClient(bridge: DesktopBridgeApi | undefined) {
  return {
    isAvailable: () => Boolean(bridge),
    listTasks: () => bridge?.listTasks() ?? Promise.resolve([]),
    createTask: (record) => bridge ? bridge.createTask(record) : Promise.resolve(),
    updateTask: (record) => bridge ? bridge.updateTask(record) : Promise.resolve(),
    saveImportBatch: (request) => {
      if (!bridge) throw new Error('Desktop bridge unavailable');
      return bridge.saveImportBatch(request);
    },
    saveTaskOutputs: (request) => {
      if (!bridge) throw new Error('Desktop bridge unavailable');
      return bridge.saveTaskOutputs(request);
    },
    settings: {
      get: () => {
        if (!bridge) throw new Error('Desktop bridge unavailable');
        return bridge.settings.get();
      },
      save: (settings) => {
        if (!bridge) throw new Error('Desktop bridge unavailable');
        return bridge.settings.save(settings);
      },
    },
    imageTask: {
      submit: (request) => {
        if (!bridge) throw new Error('Desktop bridge unavailable');
        return bridge.imageTask.submit(request);
      },
      cancel: (taskId) => {
        if (!bridge) throw new Error('Desktop bridge unavailable');
        return bridge.imageTask.cancel(taskId);
      },
      get: (taskId) => {
        if (!bridge) throw new Error('Desktop bridge unavailable');
        return bridge.imageTask.get(taskId);
      },
      onStatus: (listener) => {
        if (!bridge) return () => undefined;
        return bridge.imageTask.onStatus(listener);
      },
    },
  };
}

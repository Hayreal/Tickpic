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
  };
}

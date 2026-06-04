import path from 'node:path';

export function getStoragePaths(userDataDir: string) {
  const storageBase = path.join(userDataDir, 'storage');
  return {
    storageBase,
    importsDir: path.join(storageBase, 'imports'),
    outputsDir: path.join(storageBase, 'outputs'),
    tasksDir: path.join(storageBase, 'tasks'),
    tasksFile: path.join(storageBase, 'tasks', 'tasks.json'),
    settingsFile: path.join(storageBase, 'settings', 'settings.json'),
  };
}

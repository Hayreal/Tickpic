import path from 'node:path';

export interface WorkspacePaths {
  root: string;
  importsDir: string;
  outputsDir: string;
  tasksFile: string;
}

export function resolveWorkspacePaths(workspaceDir: string): WorkspacePaths {
  const root = path.resolve(workspaceDir);
  return {
    root,
    importsDir: path.join(root, 'imports'),
    outputsDir: path.join(root, 'outputs'),
    tasksFile: path.join(root, 'tasks', 'tasks.json'),
  };
}

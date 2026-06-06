import path from 'node:path';

export function assertPathsUnderAuthorizedRoots(filePaths: string[], authorizedRoots: string[]) {
  const normalizedRoots = authorizedRoots.map((root) => path.resolve(root));

  for (const filePath of filePaths) {
    const resolvedPath = path.resolve(filePath);
    const isAuthorized = normalizedRoots.some((root) => (
      resolvedPath === root || resolvedPath.startsWith(`${root}${path.sep}`)
    ));

    if (!isAuthorized) {
      throw new Error('file path is outside authorized roots');
    }
  }
}

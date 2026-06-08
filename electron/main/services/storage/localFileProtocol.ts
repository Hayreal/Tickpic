import { net, protocol } from 'electron';
import { pathToFileURL } from 'node:url';
import { assertPathsUnderAuthorizedRoots } from './pathAuthorization.js';

export const LOCAL_FILE_PROTOCOL = 'tickpic-file';

type AuthorizedRootsResolver = () => string[] | Promise<string[]>;

export function decodeLocalFileProtocolUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== `${LOCAL_FILE_PROTOCOL}:` || parsed.hostname !== 'image') {
    throw new Error('unsupported local file protocol url');
  }

  const encodedPath = parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
  if (!encodedPath) {
    throw new Error('missing local file path');
  }

  return decodeURIComponent(encodedPath);
}

export function assertLocalFilePathAuthorized(filePath: string, authorizedRoots: string[]) {
  assertPathsUnderAuthorizedRoots([filePath], authorizedRoots);
}

export function registerLocalFileProtocol(options: { resolveAuthorizedRoots: AuthorizedRootsResolver }) {
  protocol.handle(LOCAL_FILE_PROTOCOL, async (request) => {
    try {
      const filePath = decodeLocalFileProtocolUrl(request.url);
      const authorizedRoots = await Promise.resolve(options.resolveAuthorizedRoots());
      assertLocalFilePathAuthorized(filePath, authorizedRoots);
      return net.fetch(pathToFileURL(filePath).toString());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load local image';
      return new Response(message, { status: 403 });
    }
  });
}

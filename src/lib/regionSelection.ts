import type { RegionInput } from '../shared/domain/imageFeatureApi';

export type RegionMap = Record<string, RegionInput | null>;

export function regionForPath(map: RegionMap, path: string): RegionInput | null {
  return map[path] ?? null;
}

export function setRegionForPath(
  map: RegionMap,
  path: string,
  region: RegionInput | null,
): RegionMap {
  if (!region) {
    const next = { ...map };
    delete next[path];
    return next;
  }

  return {
    ...map,
    [path]: region,
  };
}

export function pruneRegionMap(map: RegionMap, paths: string[]): RegionMap {
  const allowed = new Set(paths);
  return Object.fromEntries(
    Object.entries(map).filter(([path]) => allowed.has(path)),
  );
}

export function regionsFromMap(map: RegionMap, path: string) {
  const region = regionForPath(map, path);
  return region ? [region] : undefined;
}

export function regionMapFromTask(
  imports: Array<{ filePath: string }>,
  regions?: RegionInput[],
): RegionMap {
  const region = regions?.[0];
  const path = imports[0]?.filePath;
  if (!region || !path) {
    return {};
  }

  return { [path]: region };
}

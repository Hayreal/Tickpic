import { describe, expect, it } from 'vitest';
import {
  pruneRegionMap,
  regionMapFromTask,
  regionsFromMap,
  setRegionForPath,
} from '../regionSelection';

describe('regionSelection', () => {
  it('stores and reads regions by image path', () => {
    const map = setRegionForPath({}, '/tmp/a.png', {
      id: 'source-/tmp/a.png',
      imageRole: 'source',
      x: 1,
      y: 2,
      width: 10,
      height: 20,
    });

    expect(regionsFromMap(map, '/tmp/a.png')).toEqual([{
      id: 'source-/tmp/a.png',
      imageRole: 'source',
      x: 1,
      y: 2,
      width: 10,
      height: 20,
    }]);
    expect(regionsFromMap(map, '/tmp/b.png')).toBeUndefined();
  });

  it('prunes regions when images are removed from batch', () => {
    const map = {
      '/tmp/a.png': {
        id: 'a',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      },
      '/tmp/b.png': {
        id: 'b',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      },
    };

    expect(pruneRegionMap(map, ['/tmp/a.png'])).toEqual({
      '/tmp/a.png': map['/tmp/a.png'],
    });
  });

  it('restores a single region onto the first import path', () => {
    expect(regionMapFromTask(
      [{ filePath: '/tmp/source.png' }],
      [{ id: 'region-1', x: 0, y: 0, width: 4, height: 4 }],
    )).toEqual({
      '/tmp/source.png': { id: 'region-1', x: 0, y: 0, width: 4, height: 4 },
    });
  });
});

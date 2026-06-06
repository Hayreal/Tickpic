export interface ImageDimensions {
  width: number;
  height: number;
}

export function readImageDimensionsFromBuffer(buffer: Buffer): ImageDimensions {
  if (isPng(buffer)) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if (isJpeg(buffer)) {
    return readJpegDimensions(buffer);
  }

  if (isWebp(buffer)) {
    return readWebpDimensions(buffer);
  }

  throw new Error('unsupported image format for bounds check');
}

function isPng(buffer: Buffer) {
  return buffer.length >= 24
    && buffer.readUInt32BE(0) === 0x89504e47
    && buffer.readUInt32BE(4) === 0x0d0a1a0a;
}

function isJpeg(buffer: Buffer) {
  return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8;
}

function isWebp(buffer: Buffer) {
  return buffer.length >= 16
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP';
}

function readJpegDimensions(buffer: Buffer): ImageDimensions {
  let offset = 2;

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      throw new Error('invalid jpeg marker sequence');
    }

    const marker = buffer[offset + 1];
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > buffer.length) {
      throw new Error('invalid jpeg segment length');
    }

    if (
      marker === 0xc0
      || marker === 0xc1
      || marker === 0xc2
      || marker === 0xc3
      || marker === 0xc5
      || marker === 0xc6
      || marker === 0xc7
      || marker === 0xc9
      || marker === 0xca
      || marker === 0xcb
      || marker === 0xcd
      || marker === 0xce
      || marker === 0xcf
    ) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + segmentLength;
  }

  throw new Error('jpeg SOF marker not found');
}

function readWebpDimensions(buffer: Buffer): ImageDimensions {
  const chunkType = buffer.toString('ascii', 12, 16);

  if (chunkType === 'VP8X' && buffer.length >= 30) {
    const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
    const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
    return { width, height };
  }

  if (chunkType === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    const width = 1 + (bits & 0x3fff);
    const height = 1 + ((bits >> 14) & 0x3fff);
    return { width, height };
  }

  if (chunkType === 'VP8 ' && buffer.length >= 30) {
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }

  throw new Error('unsupported webp chunk for dimension read');
}

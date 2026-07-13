export interface NormalizedStickerCapacity {
  labelText: string;
  warning?: string;
}

const MILLILITERS_PER_US_FLUID_OUNCE = 29.5735;
const GRAMS_PER_OUNCE = 28.3495;
const UNKNOWN_CAPACITY_WARNING = '无法自动换算为 ML/FL.OZ 或 G/OZ，请确认标签规格文案';
const NUMBER_PATTERN = '(?:\\d+(?:\\.\\d+)?|\\.\\d+)';

const EXPLICIT_VOLUME_PATTERN = new RegExp(
  `^(${NUMBER_PATTERN})\\s*ml\\s*\\/\\s*(${NUMBER_PATTERN})\\s*fl\\s*\\.?\\s*oz$`,
  'i',
);
const EXPLICIT_MASS_PATTERN = new RegExp(
  `^(${NUMBER_PATTERN})\\s*g\\s*\\/\\s*(${NUMBER_PATTERN})\\s*oz$`,
  'i',
);
const METRIC_PATTERN = new RegExp(`^(${NUMBER_PATTERN})\\s*(ml|g)$`, 'i');
const PIECE_COUNT_PATTERN = new RegExp(
  `^(${NUMBER_PATTERN})\\s*(?:pieces?|pcs?)$`,
  'i',
);

export function normalizeStickerCapacity(input: string): NormalizedStickerCapacity | undefined {
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }

  const capacityText = trimmed.replace(/^net\s*:\s*/i, '').replace(/\s+/g, ' ').trim();
  if (!capacityText) {
    return undefined;
  }

  const explicitVolume = capacityText.match(EXPLICIT_VOLUME_PATTERN);
  if (explicitVolume) {
    return {
      labelText: `NET: ${normalizeNumber(explicitVolume[1])}ML / ${normalizeNumber(explicitVolume[2])} FL.OZ`,
    };
  }

  const explicitMass = capacityText.match(EXPLICIT_MASS_PATTERN);
  if (explicitMass) {
    return {
      labelText: `NET: ${normalizeNumber(explicitMass[1])}G / ${normalizeNumber(explicitMass[2])} OZ`,
    };
  }

  const metric = capacityText.match(METRIC_PATTERN);
  if (metric) {
    const metricValue = normalizeNumber(metric[1]);
    const isVolume = metric[2].toLowerCase() === 'ml';
    const convertedValue = formatConvertedValue(
      Number(metricValue) / (isVolume ? MILLILITERS_PER_US_FLUID_OUNCE : GRAMS_PER_OUNCE),
    );

    return {
      labelText: isVolume
        ? `NET: ${metricValue}ML / ${convertedValue} FL.OZ`
        : `NET: ${metricValue}G / ${convertedValue} OZ`,
    };
  }

  const pieceCount = capacityText.match(PIECE_COUNT_PATTERN);
  if (pieceCount) {
    return {
      labelText: `NET: ${normalizeNumber(pieceCount[1])} PIECES`,
    };
  }

  return {
    labelText: `NET: ${capacityText.toUpperCase()}`,
    warning: UNKNOWN_CAPACITY_WARNING,
  };
}

function normalizeNumber(value: string): string {
  const [integerPart, fractionalPart = ''] = value.split('.');
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, '') || '0';
  const normalizedFraction = fractionalPart.replace(/0+$/, '');

  return normalizedFraction
    ? `${normalizedInteger}.${normalizedFraction}`
    : normalizedInteger;
}

function formatConvertedValue(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return normalizeNumber(Object.is(rounded, -0) ? '0' : rounded.toFixed(2));
}

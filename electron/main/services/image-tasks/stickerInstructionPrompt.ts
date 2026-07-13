import type { ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import { normalizeStickerCapacity } from '../../../../src/shared/domain/stickerCapacity.js';
import { resolveStickerVariationStrategy } from '../../../../src/shared/domain/stickerPrompts.js';

const COMMON_OUTPUT_RULES = [
  'EXACTLY ONE FRONT-FACING FLAT 2D RECTANGULAR LABEL, CENTERED AND FILLING THE CANVAS, WITH FOUR 90-DEGREE CORNERS AND STRAIGHT EDGES.',
  'LABEL ARTWORK ONLY: no bottle, jar, box, container, scene, display stand, hand, collage, mockup, or 3D packaging.',
  'BRAND MUST BE PURE WHITE with no gradient, outline, shadow, texture, or 3D. THE PURE-WHITE BRAND WORDMARK ITSELF MUST BE HORIZONTALLY CENTERED; put ® at that brand wordmark\'s upper-right.',
  'ALL VISIBLE TEXT MUST BE NATURAL ENGLISH: no Chinese, misspellings, garbled text, pseudo-text, or duplicates.',
  'COMPLETE TITLE, BRAND, SELLING POINTS, SUBTITLE, NET LINE, AND DECORATIVE ELEMENTS; do not omit required groups.',
  'ENGLISH-ADAPTIVE TYPOGRAPHY: make the title about 20% smaller than a Chinese-equivalent treatment.',
  'COMPLETE GROUP CENTERED WITH WIDE LEFT/RIGHT SAFETY MARGINS; no clipping or blur at edges.',
] as const;

export function buildStickerInstructionPrompt(request: ImageTaskRequest): string {
  const sections = [
    section('NON-NEGOTIABLE OUTPUT CONTRACT', COMMON_OUTPUT_RULES),
    section('MODE CONTRACT', buildModeContract(request)),
  ];

  if (request.feature === 'sticker_variation') {
    const strategy = resolveStickerVariationStrategy({
      direction: request.stickerVariationDirection,
      productName: request.productName,
      sellingPoints: request.sellingPoints,
      colorScheme: request.colorScheme,
      colorBlockLayout: request.colorBlockLayout,
    });
    sections.push(section('VARIATION STRATEGY', [
      `STRATEGY: ${strategy.value}`,
      `CHANGE: ${strategy.change.join('; ')}`,
      `PRESERVE: ${strategy.preserve.join('; ')}`,
      `FORBID: ${strategy.forbid.join('; ')}`,
    ]));
  }

  sections.push(section('STRUCTURED CONTENT — OVERRIDES THE REFERENCE', buildStructuredContent(request)));
  if (request.prompt?.trim()) {
    sections.push(section('LOW-PRIORITY USER NOTES', [request.prompt.trim()]));
  }
  sections.push(section('FINAL CHECK', [
    'Verify every non-negotiable rule and structured field before outputting the one label artwork.',
  ]));
  return sections.join('\n\n');
}

function section(title: string, lines: readonly string[]) {
  return [`[${title}]`, ...lines].join('\n');
}

function buildModeContract(request: ImageTaskRequest): string[] {
  if (request.feature === 'sticker_replica') {
    const rules = [
      'DE-PERSPECTIVE AND UNWRAP THE SOURCE into a front-facing flat label.',
      'Preserve source fields that the user did not override.',
    ];
    if (request.images?.some((image) => image.role === 'logo')) {
      rules.push('SUPPLIED LOGO IMAGE IS FOR BRAND IDENTIFICATION ONLY; do not use it as a layout, palette, style, or visual-design reference. The source label remains the relevant design source.');
    }
    return rules;
  }
  if (request.feature === 'sticker_variation') {
    return ['Obey exactly the resolved variation strategy; it governs what may change, preserve, and forbid.'];
  }
  return [
    'Build a fresh hierarchy from the structured content.',
    'STYLE IMAGES ARE VISUAL-LANGUAGE REFERENCES ONLY; DO NOT COPY THEIR WORDING OR LAYOUT.',
    'Do not invent certifications or claims.',
  ];
}

function buildStructuredContent(request: ImageTaskRequest): string[] {
  const brand = request.brand?.trim() || request.logoText?.trim() || 'wkau';
  const lines = [`BRAND: ${brand}®`];
  addField(lines, 'PRODUCT NAME', request.productName);
  addField(lines, 'PRODUCT CATEGORY', request.productCategory);
  const sellingPoints = request.sellingPoints?.map((point) => point.trim()).filter(Boolean);
  if (sellingPoints?.length) lines.push(`SELLING POINTS: ${sellingPoints.join('; ')}`);
  const capacity = request.capacity ? normalizeStickerCapacity(request.capacity) : undefined;
  if (capacity) lines.push(capacity.labelText);
  addField(lines, 'MATERIAL', request.material);
  addField(lines, 'STYLE', request.style);
  addField(lines, 'COLOR SCHEME', request.colorScheme);
  addField(lines, 'COLOR BLOCK LAYOUT', request.colorBlockLayout);
  return lines;
}

function addField(lines: string[], label: string, value?: string) {
  if (value?.trim()) lines.push(`${label}: ${value.trim()}`);
}

import type {
  ComparisonIntensity,
  ComparisonLayout,
  ImageFeature,
  ImageTaskRequest,
  MultiSceneLayout,
  ProductEffectMode,
  ProductHandheldMode,
} from '../../../../src/shared/domain/imageFeatureApi.js';
import type {
  ProductSetVisionBatch,
  ProductSetVisionInstructionItem,
} from '../../../../src/shared/domain/productSetVisionInstructions.js';
import { findProductHandheldReferenceByPath } from '../../../../src/shared/domain/productHandheldReferences.js';

export type ProductSetJsonSpec = Record<string, unknown> & {
  task: ImageFeature;
  style: string;
  output: {
    aspect_ratio: string;
    color_profile: string;
    render_intent: string;
    marketplace: string;
  };
  sku_lock: {
    source: string;
    must_preserve: string[];
    forbidden: string[];
  };
  presentation?: {
    mode: MainImagePresentationMode;
    carousel_ready: boolean;
    batch_role: string;
    batch_distribution: string;
  };
  composition: Record<string, unknown>;
  lighting: Record<string, unknown>;
  camera: Record<string, unknown>;
  color_grading: Record<string, unknown>;
  quality_targets: string[];
  negative_prompt: string[];
  user_overrides: Record<string, unknown>;
  variant?: {
    index: number;
    total: number;
    cycle?: number;
    directive: string;
    presentation_mode?: MainImagePresentationMode;
    single_image_only: true;
    forbidden: string[];
  };
  batch_output?: {
    count: number;
    require_distinct: true;
    delivery: string;
    meaning: string;
    forbidden: string[];
    diversity: {
      min_changed_dimensions: number;
      dimensions: string[];
      slots: Array<{ index: number; directive: string }>;
    };
  };
  handheld?: Record<string, unknown>;
  handheld_reference?: Record<string, unknown>;
  effect?: Record<string, unknown>;
  spray_physics?: Record<string, unknown>;
  copy?: Record<string, unknown>;
  panels?: Record<string, unknown>;
  product_overlay?: Record<string, unknown>;
  intensity?: ComparisonIntensity;
  intensity_guidance?: string;
  environment?: Record<string, unknown>;
};

type MainImageFields = {
  presentation?: NonNullable<ProductSetJsonSpec['presentation']>;
  scene_storytelling?: Record<string, unknown>;
  handheld: NonNullable<ProductSetJsonSpec['handheld']>;
  handheld_reference?: NonNullable<ProductSetJsonSpec['handheld_reference']>;
  effect: NonNullable<ProductSetJsonSpec['effect']>;
  spray_physics?: NonNullable<ProductSetJsonSpec['spray_physics']>;
  composition: ProductSetJsonSpec['composition'];
  copy: NonNullable<ProductSetJsonSpec['copy']>;
  quality_targets: string[];
  negative_prompt: string[];
  image_inputs?: Record<string, unknown>;
};

const PRODUCT_SET_PRIORITY =
  'sku_lock > handheld_reference (when provided) > structured controls (handheld/effect/layout) > composition hard rules > variant directive > batch_output > user scene > supplement > avoid > free visual direction within allowed approaches';

const SKU_LOCK = {
  source: 'single primary SKU product photo as the only product identity reference',
  must_preserve: [
    'packaging structure',
    'exact product aspect ratio',
    'bottle/can/tube silhouette',
    'cap/nozzle/trigger geometry',
    'material, color, transparency, gloss',
    'primary label layout, brand, product name, capacity',
    'logo, brand text, and primary label position relative to nozzle/cap/orifice end (actuator end)',
  ],
  forbidden: [
    'redesign packaging',
    'stretch, squash, thin, or widen the product',
    'change nozzle/cap/trigger structure',
    'alter brand, product name, or capacity',
    'flip or mirror the label independently of the bottle body',
  ],
} as const;

const HANDHELD_RULES = [
  'exact original product aspect ratio only; never stretch or squash',
  'natural real-hand-to-product scale',
  'all 5 fingers visible and anatomically correct',
  'thumb must be visible in a real grip position',
  'thumb must not hide under the bottle bottom or appear below the product',
  'product bottom should not extend past the wrist',
  'no giant hand with tiny product, and no tiny hand with giant product',
  'do not cover primary front label, brand text, nozzle, or actuator',
  'logo, brand text, and primary label must stay on the same physical end as the nozzle/orifice/cap (actuator end), matching the SKU photo',
  'when held inverted or tilted for use, the whole bottle body rotates together; never flip or mirror the label separately from the body',
  'actuator end (nozzle, pump, trigger, tip, cap) must point toward the use/dispensing direction, not toward the gripping hand tail',
] as const;

const SPRAY_PHYSICS = {
  applies_only_if: 'SKU has a real spray nozzle, pump, trigger, or orifice',
  nozzle_must_match_sku: true,
  spray_origin: 'real nozzle orifice only',
  spray_direction: 'aligned with nozzle facing direction',
  actuator_state: 'pressed or open when spraying',
  forbidden: [
    'spray from bottle side, back, bottom, or empty air',
    'wrong nozzle/cap/trigger geometry versus SKU',
    'spray direction that disagrees with nozzle facing',
  ],
} as const;

const MAIN_NEGATIVE = [
  'no small icon selling points',
  'no 3-icon feature rows or badge clutter',
  'no parameter stacks, price, discount, or watermark',
  'no Chinese marketing text',
  'no redesigned SKU packaging',
  'no triptych or multi-panel collage in one image',
  'no split-screen grid showing multiple use-case scenes in one frame',
] as const;

const HANDHELD_NEGATIVE = [
  'no free-standing product without a hand',
  'no product standing alone on a table or floor',
  'no missing thumb, fused fingers, extra fingers, or distorted hands',
  'no exaggerated product taller than the wrist in handheld shots',
  'no logo or primary label on the tail/base end when the nozzle/orifice is the dispensing end',
  'no upside-down or mirrored label relative to the nozzle/cap/orifice end',
  'no label flipped independently while the bottle body rotates',
] as const;

const BATCH_DIVERSITY_FORBIDDEN = [
  'recolor-only changes',
  'headline-only changes',
  'minor product nudges without composition change',
  'decoration-only swaps',
  'same composition with a different SKU',
  'horizontal flip or mirror of the whole scene',
] as const;

const BATCH_DIVERSITY_DIRECTION_COUNT = 3;

const AUTO_COMPARISON_LAYOUTS = [
  'horizontal',
  'vertical',
  'grid_2x2',
  'grid_3x2',
] as const;

const COMPARISON_EVIDENCE_FRAMINGS = [
  'tight macro crop of one clear problem area',
  'contextual medium-distance crop showing the object and target region',
  'edge-to-edge material-detail crop that emphasizes texture or boundary damage',
  'wider crop that establishes the whole object while keeping the evidence readable',
] as const;

export type ResolvedMultiSceneLayout =
  | 'single'
  | 'grid_2x2'
  | 'grid_2x3'
  | 'grid_3x2'
  | 'collage_4'
  | 'collage_5'
  | 'collage_6';

const MULTI_SCENE_GRID_LAYOUTS = ['grid_2x2', 'grid_2x3', 'grid_3x2'] as const;
const MULTI_SCENE_COLLAGE_LAYOUTS = ['collage_4', 'collage_5', 'collage_6'] as const;
const AUTO_MULTI_SCENE_LAYOUTS = [
  'grid_2x2',
  'collage_5',
  'grid_3x2',
  'collage_4',
  'grid_2x3',
  'collage_6',
] as const;

type ProductSetBatchFeature = 'product_main_image' | 'product_comparison_image' | 'product_multi_scene';

const BATCH_DIVERSITY_DIMENSIONS: Record<ProductSetBatchFeature, readonly string[]> = {
  product_main_image: [
    'target sub-scene or spatial location',
    'product position, scale, and angle in frame',
    'composition hierarchy and headline layout',
    'camera distance, angle, and framing',
    'lighting direction, intensity, and color temperature',
    'background density and spatial depth',
    'before/after presentation style when used',
  ],
  product_comparison_image: [
    'core problem sub-area within the scene',
    'evidence crop, camera distance, and target-region framing',
    'color temperature and tonal mood',
    'spatial depth and background layering',
    'lighting direction and shadow coverage',
    'visual form of the Before problem state',
  ],
  product_multi_scene: [
    'panel problem types and stain/surface categories shown',
    'headline wording and banner layout style',
    'panel grid geometry and label bar treatment',
    'lighting mood across panels',
    'target environment category (exterior vs interior surfaces)',
  ],
};

const BATCH_DIVERSITY_SLOT_DIRECTIVES: Record<ProductSetBatchFeature, readonly string[]> = {
  product_main_image: [
    'Carousel-ready hero with visible problem context (file 1): show the actual dirty/problem surface AND the SKU as scene hero WITHOUT hand or spray. Example: insect-spattered windshield with product on hood, not a shelf/catalog shot.',
    'Handheld-at-problem scene (file 2): hand holds SKU beside/at the visible problem surface, ready to use, but NO spray/effect yet. Must NOT be an empty car interior or generic portrait without the problem visible.',
    'Active effect demo (file 3): the ONLY file that may show spray/application/result directly on the problem surface. Must differ in camera/action from files 1-2.',
  ],
  product_comparison_image: [
    'Change the core problem sub-area, evidence crop, and color temperature. Do not rely on minor recolor, title-only, or product-shift differences.',
    'Change spatial depth, lighting direction/intensity, and the visual form of the Before problem while After improves the same object and region.',
    'Change camera distance, lighting direction/intensity, and problem presentation while keeping single-scene Before/After consistency.',
  ],
  product_multi_scene: [
    'Labeled multi-panel scope infographic (file 1): follow the planned grid or collage geometry and show a distinct applicable problem surface/state in every panel. Each panel gets a short English label. No product, people, or cleaning-kit hero shots.',
    'Labeled multi-panel scope infographic (file 2): use a different panel problem mix, geometry, headline placement, and label treatment from file 1 — still a multi-panel scope chart, never a single lifestyle photograph.',
    'Labeled multi-panel scope infographic (file 3): use an alternate problem-type set, panel arrangement, and banner treatment while keeping the labeled multi-panel application-scope format.',
  ],
};

function resolveMultiSceneLayout(request: ImageTaskRequest): MultiSceneLayout {
  return request.multiSceneLayout ?? 'auto';
}

export function resolveMultiScenePresentationLayout(request: ImageTaskRequest): ResolvedMultiSceneLayout {
  const requestedLayout = resolveMultiSceneLayout(request);
  const index = Math.max(0, (request.variantIndex ?? 1) - 1);

  if (requestedLayout === 'single') {
    return 'single';
  }

  if (requestedLayout === 'grid') {
    return MULTI_SCENE_GRID_LAYOUTS[index % MULTI_SCENE_GRID_LAYOUTS.length];
  }

  if (requestedLayout === 'collage') {
    return MULTI_SCENE_COLLAGE_LAYOUTS[index % MULTI_SCENE_COLLAGE_LAYOUTS.length];
  }

  return AUTO_MULTI_SCENE_LAYOUTS[index % AUTO_MULTI_SCENE_LAYOUTS.length];
}

function isMultiPanelMultiSceneLayout(layout: MultiSceneLayout | ResolvedMultiSceneLayout): boolean {
  return layout !== 'single';
}

const BATCH_PLAIN_TEXT_MARKER = '\n\n--- BATCH DIVERSITY (mandatory) ---\n';
const VARIANT_PLAIN_TEXT_MARKER = '\n\n--- VARIANT DIRECTIVE (mandatory) ---\n';

const DEFAULT_LOOK = {
  lighting: {
    key: {
      source: 'Commercial continuous LED',
      modifier: 'Large softbox',
      position: 'Front-side key, 30 degrees above eye level',
      effect: 'Clean product-readable highlights with controlled shadows',
    },
    fill: { type: 'Silver reflector', ratio: '1:3' },
    ambient: 'Controlled',
    white_balance_k: '5200',
  },
  camera: {
    system: 'Digital camera',
    sensor: 'Full-frame',
    lens: { type: 'Prime', focal_length_mm: '50' },
    exposure: { iso: '100', aperture_f: '5.6', metering: 'Product-weighted' },
    focus: {
      target: 'Product label and grip interaction',
      depth_of_field: 'Medium commercial clarity',
    },
    framing: {
      orientation: 'Square',
      crop: 'Hero product with supporting scene',
      angle: 'Eye-level',
      composition: 'Clear hero hierarchy for US Temu ecommerce',
    },
  },
  color_grading: {
    look: 'Clean commercial ecommerce, coordinated with SKU label palette',
    contrast: 'Medium',
    saturation: 'Natural',
  },
} as const;

export function isProductSetFeature(feature: ImageFeature) {
  return feature === 'product_main_image'
    || feature === 'product_comparison_image'
    || feature === 'product_multi_scene';
}

export type MainImagePresentationMode =
  | 'carousel_hero'
  | 'handheld_use'
  | 'effect_demo'
  | 'lifestyle_scene';

export interface MainImageVariantPresentation {
  mode: MainImagePresentationMode;
  handheldRequired: boolean;
  effectRequired: boolean;
  carouselReady: boolean;
  label: string;
  sceneStorytelling: {
    must_show: string[];
    forbidden: string[];
  };
}

export function resolveMainImageVariantPresentation(
  request: ImageTaskRequest,
): MainImageVariantPresentation | undefined {
  if (
    request.feature !== 'product_main_image'
    || request.variantIndex === undefined
    || request.variantTotal === undefined
    || request.variantTotal <= 1
  ) {
    return undefined;
  }

  const slot = request.variantIndex;
  const total = request.variantTotal;
  const handheldPref = request.productHandheldMode ?? 'not_handheld';
  const effectPref = request.productEffectMode ?? 'auto';

  if (slot === 1) {
    return {
      mode: 'carousel_hero',
      handheldRequired: false,
      effectRequired: false,
      carouselReady: true,
      label: '轮播首图：具体痛点场景 + 产品主视觉，无手持、无喷射，但必须看见真实问题环境',
      sceneStorytelling: {
        must_show: [
          'a specific real use location derived from the SKU category (not a generic studio)',
          'a visible problem state or dirty/target surface that this product solves',
          'SKU as scene hero with supporting props that explain the use case',
        ],
        forbidden: [
          'shelf display or retail catalog shot',
          'plain studio backdrop without a problem surface',
          'product floating on white with no context',
          'only accessory props without the actual problem area',
        ],
      },
    };
  }

  const effectSlot = resolveMainImageEffectDemoSlot(total, handheldPref, effectPref);
  if (slot === effectSlot) {
    return {
      mode: 'effect_demo',
      handheldRequired: handheldPref === 'handheld',
      effectRequired: true,
      carouselReady: false,
      label: handheldPref === 'handheld'
        ? '效果演示图：在真实痛点表面上手持喷射/使用，可见具体作用过程'
        : handheldPref === 'auto'
          ? '效果演示图（AI 判断手持）：在真实痛点表面上展示具体使用/作用过程'
          : '效果演示图：在真实痛点表面上展示具体使用/作用过程',
      sceneStorytelling: {
        must_show: [
          'the same product use case family as other files, but during active use',
          'product applied to the visible problem surface with credible action/effect',
          'spray/mist/foam/foam wipe/cleaning action only if the SKU truly supports it',
        ],
        forbidden: [
          'passive product portrait without action',
          'shelf or catalog composition',
          'effect happening away from the real problem surface',
        ],
      },
    };
  }

  if (handheldPref === 'handheld') {
    return {
      mode: 'handheld_use',
      handheldRequired: true,
      effectRequired: false,
      carouselReady: false,
      label: '手持场景图：在真实痛点场景旁手持产品，展示即将使用，但本张不出喷射/效果',
      sceneStorytelling: {
        must_show: [
          'hand holding the SKU inside or beside a concrete problem scene',
          'visible problem surface/state that explains why the product is needed',
          'realistic use location matching the SKU category',
        ],
        forbidden: [
          'hand holding product in empty car door or generic interior without the problem visible',
          'catalog/shelf presentation',
          'spray/mist/foam or finished clean result in this file',
        ],
      },
    };
  }

  if (handheldPref === 'auto' && total >= 3 && slot === 2) {
    return {
      mode: 'handheld_use',
      handheldRequired: false,
      effectRequired: false,
      carouselReady: false,
      label: '手持场景图（AI 判断）：Vision 决定是否在本文件加入手持；若 handheld_required=true 则必须手持但不出喷射/效果',
      sceneStorytelling: {
        must_show: [
          'concrete problem surface/state that explains why the product is needed',
          'realistic use location matching the SKU category',
        ],
        forbidden: [
          'catalog/shelf presentation',
          'spray/mist/foam or finished clean result in this file',
        ],
      },
    };
  }

  return {
    mode: slot === 2 ? 'lifestyle_scene' : 'carousel_hero',
    handheldRequired: false,
    effectRequired: false,
    carouselReady: slot !== 2 ? true : false,
    label: slot === 2
      ? '痛点场景图：无手持、无特效，但画面必须清楚展示具体问题和适用环境'
      : '轮播补充图：具体痛点场景中的产品主视觉，无手持、无特效',
    sceneStorytelling: slot === 2
      ? {
        must_show: [
          'a clearly readable problem surface/state without hands',
          'environment props that match the SKU use case',
        ],
        forbidden: ['catalog/shelf shot', 'generic lifestyle without visible problem'],
      }
      : {
        must_show: [
          'specific use location and visible problem context',
          'product as hero without hands',
        ],
        forbidden: ['shelf display', 'empty studio backdrop'],
      },
  };
}

function resolveMainImageEffectDemoSlot(
  total: number,
  handheldPref: ProductHandheldMode,
  effectPref: ProductEffectMode,
) {
  if (effectPref === 'hide') {
    return -1;
  }
  if (effectPref === 'show') {
    return total;
  }
  if ((handheldPref === 'handheld' || handheldPref === 'auto') && total >= 3) {
    return total;
  }
  if (total >= 2) {
    return total;
  }
  return -1;
}

export function parseProductSetJsonPrompt(text: string): ProductSetJsonSpec {
  let jsonText = text;
  for (const marker of [BATCH_PLAIN_TEXT_MARKER, VARIANT_PLAIN_TEXT_MARKER]) {
    const markerIndex = jsonText.indexOf(marker);
    if (markerIndex >= 0) {
      jsonText = jsonText.slice(0, markerIndex);
    }
  }
  return JSON.parse(jsonText.trim()) as ProductSetJsonSpec;
}

export function productSetExecutionRequiresHandheldReference(spec: ProductSetJsonSpec): boolean {
  return spec.handheld?.mode === 'handheld' && spec.handheld?.required === true;
}

export function buildProductSetJsonPrompt(request: ImageTaskRequest): string {
  if (!isProductSetFeature(request.feature)) {
    throw new Error(`buildProductSetJsonPrompt does not support feature ${request.feature}`);
  }

  return formatProductSetJsonPromptFromSpec(buildProductSetSpec(request), request);
}

export function buildProductSetExecutionPrompt(request: ImageTaskRequest): string {
  if (!isProductSetFeature(request.feature)) {
    throw new Error(`buildProductSetExecutionPrompt does not support feature ${request.feature}`);
  }

  return formatProductSetExecutionPromptFromSpec(buildProductSetSpec(request), request);
}

export function formatProductSetExecutionPromptFromSpec(
  spec: ProductSetJsonSpec,
  request: ImageTaskRequest,
): string {
  return [
    renderProductSetOutputTarget(spec),
    renderProductSetSkuReference(spec, request),
    renderProductSetFeatureContract(spec, request),
    renderProductSetScene(spec, request),
    renderProductSetCopyAndUserRequirements(spec),
  ].filter((section): section is string => Boolean(section)).join('\n\n');
}

export function formatProductSetJsonPromptFromSpec(
  spec: ProductSetJsonSpec,
  request: ImageTaskRequest,
): string {
  const json = JSON.stringify(spec, null, 2);
  const scenePrompt = request.feature === 'product_multi_scene' ? null : trimOrNull(request.scenePrompt);
  const suffix = spec.variant
    ? buildVariantPlainTextSuffix(request.feature, spec.variant, scenePrompt, request)
    : spec.batch_output
      ? buildBatchPlainTextSuffix(request.feature, spec.batch_output, scenePrompt, request)
      : '';
  return suffix ? `${json}${suffix}` : `${json}\n`;
}

function renderProductSetOutputTarget(spec: ProductSetJsonSpec) {
  return `Create one ${spec.output.aspect_ratio} ${spec.style} for ${spec.output.marketplace}. Render it as a photographic sRGB ecommerce image.`;
}

function renderProductSetSkuLock(spec: ProductSetJsonSpec) {
  const preserve = spec.sku_lock.must_preserve.join('; ');
  const forbidden = spec.sku_lock.forbidden.join('; ');
  return [
    `Use the supplied SKU as the only product identity reference. Preserve ${preserve}.`,
    `Do not ${forbidden}.`,
  ].join(' ');
}

function renderProductSetSkuReference(spec: ProductSetJsonSpec, request: ImageTaskRequest) {
  if (request.feature === 'product_multi_scene') {
    return 'Use the supplied SKU photo only to identify legitimate product use cases; do not render its body, packaging, brand, or label.';
  }

  return renderProductSetSkuLock(spec);
}

function renderProductSetFeatureContract(spec: ProductSetJsonSpec, request: ImageTaskRequest) {
  switch (request.feature) {
    case 'product_main_image':
      return renderMainImageFeatureContract(spec);
    case 'product_comparison_image':
      return renderComparisonFeatureContract(spec);
    case 'product_multi_scene':
      return renderMultiSceneFeatureContract(spec);
    default:
      return '';
  }
}

function renderMainImageFeatureContract(spec: ProductSetJsonSpec) {
  const handheld = asRecord(spec.handheld);
  const effect = asRecord(spec.effect);
  const reference = asRecord(spec.handheld_reference);
  const presentation = asRecord(spec.presentation);
  const statements = [
    presentation?.mode
      ? `This is a ${mainImagePresentationExecutionSummary(String(presentation.mode))}.`
      : 'Create one coherent ecommerce main-image scene.',
    'Show the product, an actual use target, and an observable pre-use, action, or result state in one coherent scene.',
    'Use one continuous photograph, never a split screen, triptych, or collage.',
  ];

  if (handheld?.mode === 'handheld') {
    statements.push('Show a natural hand directly using or holding the SKU beside the actual use target.');
    if (reference) {
      statements.push('Match the supplied hand-reference grip and pose while keeping the SKU identity locked to the product reference.');
    }
  } else {
    statements.push('Do not show a holding hand; place the SKU naturally as the scene hero.');
  }

  if (effect?.mode === 'show') {
    statements.push('When showing product action, it must originate from the SKU’s real actuator and visibly act on the actual use target.');
  } else {
    statements.push('Do not show product-emitted action effects; keep the actual target state visible.');
  }

  return statements.join(' ');
}

function mainImagePresentationExecutionSummary(mode: string) {
  switch (mode) {
    case 'carousel_hero':
      return 'carousel-opening hero image with a specific pain-point environment, the SKU as the clear visual hero, no handheld use, and no product action effect';
    case 'handheld_use':
      return 'handheld-use image with the SKU held naturally beside the real problem surface, without product action effects';
    case 'effect_demo':
      return 'effect-demonstration image with real product action visibly applied to the actual problem surface';
    case 'lifestyle_scene':
      return 'lifestyle-use image grounded in a real, relevant problem environment';
    default:
      return 'coherent ecommerce main-image scene';
  }
}

function renderComparisonFeatureContract(spec: ProductSetJsonSpec) {
  const composition = asRecord(spec.composition);
  const overlay = asRecord(spec.product_overlay);
  const layout = comparisonLayoutDescription(String(composition?.layout ?? 'auto'));
  const evidenceFraming = comparisonEvidenceFramingInstruction(String(composition?.evidence_framing ?? '').trim());
  const statements = [
    `Create a credible Before/After comparison: ${layout}`,
    'The Before and After evidence must show the same relevant object or region with a real, observable improvement.',
    ...(evidenceFraming ? [evidenceFraming] : []),
  ];

  if (overlay?.enabled === true) {
    statements.push('Use one readable foreground product layer integrated with the comparison frame, positioned in unused comparison space. It must not cover the evidence or cause unrelated display surfaces or filler props to be introduced; do not add a tabletop, pedestal, or display surface just to hold the product.');
  } else {
    statements.push('Do not render the SKU in the comparison; communicate the improvement through the matched evidence only.');
  }
  statements.push('Keep the frame focused on the matched Before/After target and optional SKU layer. Do not add towels, brushes, cleaning tools, or accessory props unless they are part of the actual target problem.');

  return statements.join(' ');
}

function comparisonLayoutDescription(layout: string) {
  switch (layout) {
    case 'horizontal':
      return 'show BEFORE on the left and AFTER on the right for one matched target region.';
    case 'vertical':
      return 'show BEFORE above and AFTER below for one matched target region.';
    case 'grid_2x2':
      return 'use two rows, each with a matched BEFORE-left and AFTER-right pair for one relevant target region.';
    case 'grid_3x2':
      return 'use three rows, each with a matched BEFORE-left and AFTER-right pair for one relevant target region.';
    default:
      return 'choose the clearest matched Before/After arrangement for the target region.';
  }
}

function comparisonEvidenceFramingInstruction(framing: string) {
  switch (framing) {
    case 'tight macro crop of one clear problem area':
      return 'Use a tight macro evidence crop that makes the specific problem texture or residue immediately readable.';
    case 'contextual medium-distance crop showing the object and target region':
      return 'Use a contextual medium-distance evidence crop that shows the object and the affected target region together.';
    case 'edge-to-edge material-detail crop that emphasizes texture or boundary damage':
      return 'Use an edge-to-edge material-detail evidence crop that emphasizes texture, seams, grain, or damage boundaries.';
    case 'wider crop that establishes the whole object while keeping the evidence readable':
      return 'Use a wider object-context evidence crop that establishes the whole item while keeping the improvement readable.';
    default:
      return framing;
  }
}

function renderMultiSceneFeatureContract(spec: ProductSetJsonSpec) {
  const composition = asRecord(spec.composition);
  const panels = asRecord(spec.panels);
  const layout = String(composition?.layout ?? 'single');
  const layoutDescription = multiSceneLayoutDescription(layout);
  const statements = [
    'Do not render the SKU body, packaging, people, faces, hands, or handheld use.',
    layoutDescription,
  ];
  const visionPanels = Array.isArray(panels?.vision_panels) ? panels.vision_panels : [];
  if (visionPanels.length > 0) {
    const panelSummary = visionPanels
      .map((panel) => asRecord(panel))
      .filter((panel): panel is Record<string, unknown> => Boolean(panel?.label))
      .map((panel) => `${String(panel.label)} (${String(panel.problem_surface)}: ${String(panel.problem_state)})`)
      .join('; ');
    if (panelSummary) {
      statements.push(`Use these panel subjects: ${panelSummary}.`);
    }
  }

  return statements.join(' ');
}

function multiSceneLayoutDescription(layout: string) {
  switch (layout) {
    case 'grid_2x2':
      return 'Use a readable four-cell 2x2 grid; every cell shows a distinct applicable problem surface or state with a short English label.';
    case 'grid_2x3':
      return 'Use a readable six-cell 2x3 grid; every cell shows a distinct applicable problem surface or state with a short English label.';
    case 'grid_3x2':
      return 'Use a readable six-cell 3x2 grid; every cell shows a distinct applicable problem surface or state with a short English label.';
    case 'collage_4':
      return 'Use a readable four-panel asymmetric collage with visible dividers; every panel shows a distinct applicable problem surface or state with a short English label.';
    case 'collage_5':
      return 'Use a readable five-panel asymmetric collage with visible dividers; every panel shows a distinct applicable problem surface or state with a short English label.';
    case 'collage_6':
      return 'Use a readable six-panel asymmetric collage with visible dividers; every panel shows a distinct applicable problem surface or state with a short English label.';
    default:
      return 'Show one complete target scene with a visible pre-use problem state.';
  }
}

function renderProductSetScene(spec: ProductSetJsonSpec, request: ImageTaskRequest) {
  const environment = asRecord(spec.environment);
  const storytelling = asRecord(spec.scene_storytelling);
  const composition = asRecord(spec.composition);
  const variant = spec.variant;
  const sections: string[] = [];

  if (environment?.location) {
    sections.push(`Use location: ${String(environment.location)}.`);
  }
  if (environment?.set) {
    sections.push(`Set dressing: ${String(environment.set)}.`);
  }
  if (storytelling?.problem_surface || storytelling?.problem_state) {
    sections.push(`Make the target clear: ${[storytelling.problem_surface, storytelling.problem_state].filter(Boolean).join('; ')}.`);
  }
  if (composition?.vision_directive) {
    sections.push(`Composition: ${String(composition.vision_directive)}.`);
  }
  if (variant?.directive) {
    sections.push(`Make this variant distinct through: ${variant.directive}.`);
  }
  const userScene = request.feature === 'product_multi_scene' ? null : trimOrNull(request.scenePrompt);
  if (userScene) {
    sections.push(`User scene direction: ${userScene}.`);
  }

  return sections.join(' ');
}

function renderProductSetCopyAndUserRequirements(spec: ProductSetJsonSpec) {
  const copy = asRecord(spec.copy);
  const headline = asRecord(copy?.headline);
  const overrides = asRecord(spec.user_overrides);
  const sections = ['Use only concise, readable English visible copy. Do not add icon rows, price, discount, watermark, or long explanatory text.'];

  if (headline?.suggested_text) {
    sections.push(`Suggested headline: ${String(headline.suggested_text)}.`);
  }
  if (overrides?.supplement) {
    sections.push(`Additional direction: ${String(overrides.supplement)}.`);
  }
  if (overrides?.avoid) {
    sections.push(`Avoid: ${String(overrides.avoid)}.`);
  }

  return sections.join(' ');
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export function buildProductSetExecutionPromptsFromVision(
  request: ImageTaskRequest,
  batch: ProductSetVisionBatch,
): string[] {
  return buildProductSetExecutionVariantsFromVision(request, batch).map((variant) => variant.prompt);
}

export interface ProductSetExecutionVariant {
  prompt: string;
  requiresHandheldReference: boolean;
}

export function buildProductSetExecutionVariantsFromVision(
  request: ImageTaskRequest,
  batch: ProductSetVisionBatch,
): ProductSetExecutionVariant[] {
  const count = batch.instructions.length;

  return batch.instructions.map((item) => {
    const variantRequest = count > 1
      ? { ...request, count: 1, variantIndex: item.index, variantTotal: count }
      : request;
    const spec = mergeProductSetVisionInstruction(
      buildProductSetSpec(variantRequest),
      item,
      variantRequest,
    );
    return {
      prompt: formatProductSetExecutionPromptFromSpec(spec, variantRequest),
      requiresHandheldReference: productSetExecutionRequiresHandheldReference(spec),
    };
  });
}

export function mergeProductSetVisionInstruction(
  spec: ProductSetJsonSpec,
  vision: ProductSetVisionInstructionItem,
  request: ImageTaskRequest,
): ProductSetJsonSpec {
  const merged = cloneLook(spec) as ProductSetJsonSpec;

  if (vision.environment) {
    merged.environment = {
      ...(merged.environment as Record<string, unknown>),
      ...compactVisionFields(vision.environment),
    };
  }

  if (vision.composition_directive?.trim()) {
    merged.composition = {
      ...(merged.composition as Record<string, unknown>),
      vision_directive: vision.composition_directive.trim(),
    };
  }

  if (vision.headline_suggestion?.trim() && merged.copy && typeof merged.copy === 'object') {
    merged.copy = {
      ...(merged.copy as Record<string, unknown>),
      headline: {
        ...((merged.copy as Record<string, unknown>).headline as Record<string, unknown> | undefined),
        suggested_text: vision.headline_suggestion.trim(),
      },
    };
  }

  if (vision.panel_guidance?.trim() && merged.panels && typeof merged.panels === 'object') {
    merged.panels = {
      ...(merged.panels as Record<string, unknown>),
      vision_guidance: vision.panel_guidance.trim(),
    };
  }

  if (vision.panel_list?.length && merged.panels && typeof merged.panels === 'object') {
    merged.panels = {
      ...(merged.panels as Record<string, unknown>),
      vision_panels: vision.panel_list.map((panel) => ({
        label: panel.label.trim(),
        problem_surface: panel.problem_surface.trim(),
        problem_state: panel.problem_state.trim(),
      })),
    };
  }

  if (vision.scope_headline?.trim() && merged.copy && typeof merged.copy === 'object') {
    merged.copy = {
      ...(merged.copy as Record<string, unknown>),
      headline: {
        ...((merged.copy as Record<string, unknown>).headline as Record<string, unknown> | undefined),
        suggested_text: vision.scope_headline.trim(),
      },
    };
  }

  if (vision.variant_directive?.trim() && merged.variant) {
    merged.variant = {
      ...merged.variant,
      directive: vision.variant_directive.trim(),
    };
  }

  if (vision.scene_notes?.length) {
    merged.quality_targets = [
      ...(merged.quality_targets ?? []),
      ...vision.scene_notes.map((note) => note.trim()).filter(Boolean),
    ];
  }

  if (vision.problem_surface?.trim() || vision.problem_state?.trim()) {
    merged.scene_storytelling = {
      ...(asRecord(merged.scene_storytelling) ?? {}),
      ...(vision.problem_surface?.trim()
        ? { problem_surface: vision.problem_surface.trim() }
        : {}),
      ...(vision.problem_state?.trim()
        ? { problem_state: vision.problem_state.trim() }
        : {}),
    };
  }

  if (request.feature === 'product_main_image') {
    applyVisionMainImageHandheldEffect(merged, vision, request);
  }

  return merged;
}

function resolveVisionHandheldRequired(
  request: ImageTaskRequest,
  vision: ProductSetVisionInstructionItem,
): boolean {
  const pref = request.productHandheldMode ?? 'auto';
  if (pref === 'not_handheld') {
    return false;
  }
  if (pref === 'handheld') {
    const presentation = resolveMainImageVariantPresentation(request);
    return presentation?.handheldRequired ?? true;
  }
  return vision.handheld_required ?? resolveMainImageVariantPresentation(request)?.handheldRequired ?? false;
}

function resolveVisionEffectRequired(
  request: ImageTaskRequest,
  vision: ProductSetVisionInstructionItem,
): boolean {
  const pref = request.productEffectMode ?? 'auto';
  if (pref === 'hide') {
    return false;
  }
  if (pref === 'show') {
    return true;
  }
  return vision.show_effect ?? resolveMainImageVariantPresentation(request)?.effectRequired ?? false;
}

function applyVisionMainImageHandheldEffect(
  merged: ProductSetJsonSpec,
  vision: ProductSetVisionInstructionItem,
  request: ImageTaskRequest,
) {
  const handheldRequired = resolveVisionHandheldRequired(request, vision);
  const effectRequired = resolveVisionEffectRequired(request, vision);
  const patch = buildMainImageFields(request, { handheldRequired, effectRequired });

  merged.handheld = patch.handheld;
  merged.effect = patch.effect;
  if (patch.spray_physics) {
    merged.spray_physics = patch.spray_physics;
  } else {
    delete merged.spray_physics;
  }
  if (patch.handheld_reference) {
    merged.handheld_reference = patch.handheld_reference;
  } else {
    delete merged.handheld_reference;
  }
  if (patch.image_inputs) {
    merged.image_inputs = patch.image_inputs;
  } else {
    delete merged.image_inputs;
  }
  merged.composition = {
    ...(merged.composition as Record<string, unknown>),
    ...(patch.composition as Record<string, unknown>),
  };
  merged.quality_targets = patch.quality_targets;
  merged.negative_prompt = patch.negative_prompt;
}

export function buildProductSetSpec(request: ImageTaskRequest): ProductSetJsonSpec {
  const scene = request.feature === 'product_multi_scene' ? null : trimOrNull(request.scenePrompt);
  const supplement = trimOrNull(request.prompt);
  const avoid = trimOrNull(request.negativePrompt);

  const draft: Record<string, unknown> = {
    task: request.feature,
    style: styleForFeature(request.feature, resolveMultiScenePresentationLayout(request)),
    output: {
      aspect_ratio: request.aspectRatio?.trim() && request.aspectRatio !== 'auto'
        ? request.aspectRatio.trim()
        : '1:1',
      color_profile: 'sRGB',
      render_intent: 'Photographic',
      marketplace: 'US Temu ecommerce',
    },
    sku_lock: {
      ...SKU_LOCK,
      must_preserve: [...SKU_LOCK.must_preserve],
      forbidden: [...SKU_LOCK.forbidden],
    },
  };

  switch (request.feature) {
    case 'product_main_image':
      Object.assign(draft, buildMainImageFields(request));
      break;
    case 'product_comparison_image':
      Object.assign(draft, buildComparisonFields(request));
      break;
    case 'product_multi_scene':
      Object.assign(draft, buildMultiSceneFields(request));
      break;
    default:
      break;
  }

  draft.environment = environmentForFeature(request.feature, scene, supplement);
  draft.lighting = cloneLook(DEFAULT_LOOK.lighting);
  draft.camera = cloneLook(DEFAULT_LOOK.camera);
  draft.color_grading = cloneLook(DEFAULT_LOOK.color_grading);
  draft.user_overrides = buildUserOverrides(scene, supplement, avoid);

  const batchCount = resolveBatchCount(request);
  const variant = buildVariantField(request);
  if (variant) {
    draft.variant = variant;
  } else if (batchCount > 1) {
    draft.batch_output = buildBatchOutput(request.feature, batchCount);
  }

  return orderedSpec(draft);
}

function buildMainImageFields(
  request: ImageTaskRequest,
  overrides?: { handheldRequired?: boolean; effectRequired?: boolean },
) {
  const handheldMode: ProductHandheldMode = request.productHandheldMode ?? 'auto';
  const effectMode: ProductEffectMode = request.productEffectMode ?? 'auto';
  const hasReference = hasReferenceImage(request);
  const presentation = resolveMainImageVariantPresentation(request);
  const isHandheld = overrides?.handheldRequired ?? (
    presentation
      ? presentation.handheldRequired
      : handheldMode === 'handheld'
  );
  const effectRequired = overrides?.effectRequired ?? (
    presentation
      ? presentation.effectRequired
      : effectMode === 'show'
  );
  const effectGuidanceText = presentation
    ? presentation.effectRequired
      ? effectGuidance('show')
      : effectGuidance('hide')
    : effectGuidance(effectMode);

  const fields: MainImageFields = {
    ...(presentation ? {
      presentation: {
        mode: presentation.mode,
        carousel_ready: presentation.carouselReady,
        batch_role: presentation.label,
        batch_distribution: 'Handheld and effect are assigned per output file in this batch; obey this file\'s presentation block only.',
      },
      scene_storytelling: presentation.sceneStorytelling,
    } : {}),
    handheld: isHandheld
      ? hasReference
        ? {
            mode: 'handheld',
            required: true,
            must: 'Match the grip, hand pose, and held product form from the reference image while applying the SKU product identity',
            reference_driven: true,
          }
        : {
            mode: 'handheld',
            required: true,
            must: 'A real human hand must visibly hold or operate the SKU in the final image',
            rules: [...HANDHELD_RULES],
          }
      : {
          mode: 'not_handheld',
          required: true,
          must: 'No hand may hold the SKU; place the product as the scene hero',
          rules: [
            'SKU must not be held by a hand; place product as the scene hero',
          ],
        },
    effect: {
      mode: presentation
        ? (presentation.effectRequired ? 'show' : 'hide')
        : effectMode,
      guidance: effectGuidanceText,
    },
    composition: {
      strategy: 'free_within_controls',
      product_required: true,
      hand_required: isHandheld,
      goal: presentation?.carouselReady
        ? 'Within about 3 seconds on a product carousel, show what the product is, where it is used, and the core benefit — clean hero hierarchy without hand blocking the label'
        : 'Within about 3 seconds, show what the product is, where it is used, what problem it solves, and what result it delivers',
      allowed_approaches: isHandheld
        ? presentation?.mode === 'effect_demo'
          ? [
            'handheld action/effect demonstration',
            'handheld real usage with visible product result',
          ]
          : [
            'handheld real usage',
            'handheld usage process',
            'handheld pain-point close-up',
            'handheld lifestyle use',
          ]
        : presentation?.mode === 'effect_demo'
          ? [
            'action/effect demonstration',
            'real usage scene with visible product result',
          ]
          : [
            'real usage scene',
            'usage process',
            'pain-point close-up',
            'lifestyle placement',
            'carousel hero product placement',
            'before-after feeling within a single main image when useful',
          ],
      one_composition_only: 'Each output image is exactly ONE continuous photograph of ONE commercial scene with ONE product placement. Never stack strips, layers, triptychs, split-screen grids, or collage panels inside one frame — even to show multiple use cases.',
      forbidden_approaches: isHandheld
        ? [
            'no hand in frame',
            'free-standing bottle on table',
            'table-top product only without grip',
            'product standing alone',
            'multi-panel collage or triptych in one image',
            'split-screen showing 2/3/4 different locations in one frame',
            'multi-panel collage of different batch variants',
          ]
        : [
            'multi-panel collage or triptych in one image',
            'split-screen showing 2/3/4 different locations in one frame',
            'multi-panel collage of different batch variants',
            'stacked strips of different scenes in one image',
            'handheld use',
            'visible holding hand',
          ],
      note: presentation
        ? `Batch file presentation: ${presentation.label}. Handheld/effect settings from the UI apply across the batch but are distributed per file — obey this file's presentation block only.`
        : isHandheld
          ? hasReference
            ? 'Handheld is a hard structured control. Match the reference image grip/pose/form; sku_lock still controls product identity.'
            : 'Handheld is a hard structured control. Free composition only chooses HOW the hand holds/uses the SKU, never WHETHER a hand appears.'
          : 'Do not force one non-handheld template. Choose the strongest commercial approach for this SKU and scene; batch diversity is controlled by batch_output.',
    },
    copy: {
      headline: {
        language: 'en',
        word_count: '3-7',
        role: 'short benefit/use/result title coordinated with SKU label style',
      },
      forbidden: [
        'long paragraphs',
        'parameter stacks',
        'rows of small selling-point icons',
        'Chinese marketing text',
      ],
    },
    quality_targets: [
      'SKU identity locked to the reference photo',
      ...(presentation?.carouselReady
        ? [
          'Ready for ecommerce product carousel/slider: clean hero product placement with readable label',
          'No hand blocking the product or primary label',
        ]
        : []),
      ...(isHandheld
        ? hasReference
          ? [
              'Grip, hand pose, and held product form match the reference image',
              'SKU packaging identity still comes only from product images',
              'Logo and primary label stay on the nozzle/cap/orifice end, matching the SKU photo',
            ]
          : [
              'A real hand must appear and hold the SKU',
              'Correct hand anatomy with visible thumb',
              'Product bottom does not extend past the wrist',
              'Logo and primary label stay on the nozzle/cap/orifice end, matching the SKU photo',
            ]
        : [
            'No holding hand in frame',
          ]),
      ...(presentation && !presentation.effectRequired
        ? ['No spray, mist, foam, vapor, or product-emitted action effects in this file']
        : []),
      ...(presentation?.sceneStorytelling.must_show ?? []),
      'English headline readable in 3 seconds',
      'No small icon selling-point UI',
    ],
    negative_prompt: [
      ...MAIN_NEGATIVE,
      ...(isHandheld ? HANDHELD_NEGATIVE : ['no holding hand', 'no handheld grip']),
      ...(presentation && !presentation.effectRequired
        ? ['no spray', 'no mist', 'no foam', 'no vapor trail', 'no product-emitted effects']
        : []),
      ...(presentation?.sceneStorytelling.forbidden ?? []),
    ],
  };

  if (effectRequired) {
    fields.spray_physics = {
      ...SPRAY_PHYSICS,
      forbidden: [...SPRAY_PHYSICS.forbidden],
    };
    (fields.quality_targets as string[]).push(
      'Spray/nozzle geometry matches SKU and medium exits the real orifice in the correct direction',
    );
    (fields.negative_prompt as string[]).push('no wrong spray nozzle', 'no spray from empty air');
  }

  if (avoidExtra(request.negativePrompt)) {
    (fields.negative_prompt as string[]).push(`also avoid: ${request.negativePrompt!.trim()}`);
  }

  if (isHandheld && hasReference) {
    fields.handheld_reference = {
      source: 'attached reference image',
      apply: ['hand grip', 'hand pose', 'held product orientation and form'],
      preserve: [
        'SKU packaging identity from product images only',
        'logo, brand text, and primary label position relative to nozzle/cap/orifice end from SKU photos',
      ],
      priority: 'reference image overrides generic handheld posing rules; sku_lock still overrides product identity and label orientation relative to actuator end',
    };
  }

  const imageInputs = buildExecutionImageInputs(request, isHandheld);
  if (imageInputs) {
    fields.image_inputs = imageInputs;
  }

  return fields;
}

function buildExecutionImageInputs(request: ImageTaskRequest, handheldRequired: boolean) {
  const images = request.images ?? [];
  if (images.length === 0) {
    return undefined;
  }

  const order: Array<Record<string, string>> = [];
  for (const image of images) {
    if (image.role === 'product') {
      order.push({
        index: String(order.length + 1),
        role: 'product',
        use: 'SKU identity lock — packaging, label, and product geometry only',
      });
      continue;
    }
    if (image.role === 'reference' && handheldRequired) {
      const refDef = findProductHandheldReferenceByPath(image.path);
      order.push({
        index: String(order.length + 1),
        role: 'handheld_reference',
        use: refDef
          ? `Match hand grip/pose from reference (${refDef.label}); SKU body comes from product image(s) only`
          : 'Match hand grip and pose from this reference silhouette; SKU body comes from product image(s) only',
      });
    }
  }

  if (order.length === 0) {
    return undefined;
  }

  return {
    order,
    edit_request_note: order.some((item) => item.role === 'handheld_reference')
      ? 'Attached edit images follow this order. When handheld.required is true, replicate the handheld_reference grip/pose exactly.'
      : 'Attached edit images follow this order.',
  };
}

function buildComparisonFields(request: ImageTaskRequest) {
  const layout = resolveComparisonLayout(request);
  const evidenceFraming = resolveComparisonEvidenceFraming(request);
  const intensity: ComparisonIntensity = request.comparisonIntensity ?? 'medium';
  const showProduct = request.showProduct !== false;

  const fields: Record<string, unknown> = {
    composition: {
      type: 'single_scene_before_after',
      layout,
      layout_rules: {
        horizontal: 'BEFORE left, AFTER right',
        vertical: 'BEFORE top, AFTER bottom',
        grid_2x2: 'Two rows; each row is BEFORE left and AFTER right for one relevant target region',
        grid_3x2: 'Three rows; each row is BEFORE left and AFTER right for one relevant target region',
      }[layout],
      evidence_framing: evidenceFraming,
      invariant: 'Before and After keep the same scene, object, camera, scale, material, and structure',
      one_pair_only: layout === 'grid_2x2'
        ? 'Each output image contains two matched BEFORE/AFTER pairs arranged as rows, never unrelated process stages or stacked variants.'
        : layout === 'grid_3x2'
          ? 'Each output image contains three matched BEFORE/AFTER pairs arranged as rows, never unrelated process stages or stacked variants.'
          : 'Each output image contains exactly one matched BEFORE/AFTER pair. Never stack multiple comparison variants as layers or strips in the same image.',
    },
    panels: {
      sku_inside_panels: false,
      before: 'Show the real problem state for the user scene; no SKU inside the panel',
      after: 'Show a clear credible improvement on the same object and region; no SKU inside the panel',
    },
    product_overlay: showProduct
      ? {
          enabled: true,
          instances: 1,
          role: 'single foreground product layer outside Before/After panels',
          scale: 'noticeably larger hero product scale',
          placement: placementForLayout(layout),
          must_follow: 'sku_lock',
          must_not: [
            'duplicate SKU inside panels',
            'cover core problem area',
            'cover BEFORE/AFTER labels',
          ],
        }
      : {
          enabled: false,
          instances: 0,
          role: 'no SKU anywhere; communicate improvement only through Before/After scene states',
        },
    intensity,
    intensity_guidance: {
      light: 'Recognizable but restrained improvement; not almost identical',
      medium: 'Core problem clearly visible in Before; After improves the same area clearly and credibly',
      heavy: 'Before problem is large and obvious; After strongly improves the same object/region without swapping scene/object/camera/material/structure or faking contrast with pure grade tricks',
    }[intensity],
    copy: {
      allowed_labels: ['BEFORE', 'AFTER'],
      forbidden: [
        'benefit slogans',
        'selling-point sentences',
        'feature titles',
        'small icons',
        'extra explanatory microcopy',
        'Chinese marketing text',
      ],
    },
    quality_targets: [
      'Clear BEFORE/AFTER comparison matching the user scene pain point',
      'Same object and region before vs after',
      'Only BEFORE and AFTER as state labels',
      showProduct
        ? 'One enlarged foreground SKU that follows sku_lock and does not dominate the comparison content incorrectly'
        : 'No SKU visible anywhere in the frame',
    ],
    negative_prompt: [
      'no SKU inside Before or After panels',
      ...(layout === 'grid_2x2' || layout === 'grid_3x2'
        ? ['no unrelated multi-stage process grid']
        : ['no multi-stage process grids']),
      'no stacked multiple BEFORE/AFTER pairs in one image',
      'no three-layer or strip collage of different comparison variants',
      'no benefit slogans or icon rows',
      'no Chinese marketing text',
      'no fake contrast by only darkening Before or oversaturating After',
      ...(showProduct
        ? ['no tiny unreadable product overlay', 'no stretched/squashed SKU']
        : ['no product packaging visible']),
    ],
  };

  if (avoidExtra(request.negativePrompt)) {
    (fields.negative_prompt as string[]).push(`also avoid: ${request.negativePrompt!.trim()}`);
  }

  return fields;
}

function buildMultiSceneFields(request: ImageTaskRequest) {
  const layout = resolveMultiScenePresentationLayout(request);
  const multiPanel = isMultiPanelMultiSceneLayout(layout);
  const layoutPlan = multiSceneLayoutPlan(layout);

  const fields: Record<string, unknown> = {
    composition: {
      focus: 'application scope: distinct problem surfaces, materials, stains, or environments the SKU can address',
      layout,
      format: multiPanel ? 'labeled_multi_panel_scope_infographic' : 'single_target_scene',
      layout_rules: layoutPlan.layoutRule,
      sku_in_frame: false,
      people_allowed: false,
      note: multiPanel
        ? 'SKU photo is only for recognizing category and true use cases; output a labeled multi-panel scope infographic — never a single lifestyle detail shot with cleaning tools'
        : 'SKU photo is only for recognizing category and true use cases; never render the product body',
    },
    ...(multiPanel ? {
      panels: {
        required: true,
        min_distinct_scenes: layoutPlan.panelCount,
        structure: 'Each panel = one distinct applicable problem surface + visible before-use problem state',
        labels: 'Short English label under each panel naming the problem/stain/surface type',
        headline: layoutPlan.headlineTreatment,
        forbidden: [
          'product bottle or SKU in any panel',
          'cleaning tools, microfiber, or brushes as the hero subject',
          'single full-bleed photograph without visible panel dividers',
          'one-scene lifestyle staging instead of a scope chart',
        ],
      },
    } : {}),
    copy: {
      optional_title: 'short English main title allowed when helpful',
      panel_labels: 'short English scene or stain names required for multi-panel layouts',
      forbidden: [
        'long paragraphs',
        'parameter stacks',
        'feature icon rows',
        'Chinese marketing text',
      ],
    },
    quality_targets: [
      'No SKU, packaging, or branded container in frame',
      'No people, faces, hands, or handheld actions',
      ...(multiPanel
        ? [
            'Output is a readable labeled multi-panel scope infographic, not a single continuous photograph',
            'Each panel shows a clearly different applicable problem surface/state relevant to the SKU',
            'Panel labels and optional headline are short English text',
          ]
        : [
            'Scenes are clearly different and truly relevant to the product use case',
            'Readable commercial layout without clutter',
          ]),
    ],
    negative_prompt: [
      'no SKU product body',
      'no product packaging',
      'no branded bottle or recognizable product instance',
      'no people, body, face, hands, or handheld use',
      ...(multiPanel
        ? [
            'no single continuous photograph without panel grid',
            'no cleaning-kit flat lay or microfiber/towel hero shot',
            'no one-scene bumper/detail photo with tools in corner',
          ]
        : [
            'no weak/irrelevant filler scenes',
          ]),
      'no Chinese marketing text',
      'no icon selling-point templates',
    ],
  };

  if (avoidExtra(request.negativePrompt)) {
    (fields.negative_prompt as string[]).push(`also avoid: ${request.negativePrompt!.trim()}`);
  }

  return fields;
}

function orderedSpec(draft: Record<string, unknown>): ProductSetJsonSpec {
  const order = [
    'task',
    'style',
    'output',
    'sku_lock',
    'presentation',
    'scene_storytelling',
    'handheld',
    'handheld_reference',
    'image_inputs',
    'effect',
    'spray_physics',
    'composition',
    'panels',
    'product_overlay',
    'intensity',
    'intensity_guidance',
    'environment',
    'lighting',
    'camera',
    'color_grading',
    'copy',
    'quality_targets',
    'negative_prompt',
    'user_overrides',
    'variant',
    'batch_output',
  ] as const;

  const ordered: Record<string, unknown> = {};
  for (const key of order) {
    if (draft[key] !== undefined) {
      ordered[key] = draft[key];
    }
  }
  for (const [key, value] of Object.entries(draft)) {
    if (!(key in ordered) && value !== undefined) {
      ordered[key] = value;
    }
  }

  return ordered as ProductSetJsonSpec;
}

function resolveBatchCount(request: ImageTaskRequest) {
  if (request.count !== undefined && request.count > 1) {
    return request.count;
  }
  if (request.variantTotal !== undefined && request.variantTotal > 1) {
    return request.variantTotal;
  }
  return request.count ?? 1;
}

function buildVariantField(request: ImageTaskRequest) {
  if (
    request.variantIndex === undefined
    || request.variantTotal === undefined
    || request.variantTotal <= 1
  ) {
    return undefined;
  }

  const feature = request.feature as ProductSetBatchFeature;
  const slot = buildDiversitySlots(feature, request.variantTotal)[request.variantIndex - 1];
  const cycle = Math.floor((request.variantIndex - 1) / BATCH_DIVERSITY_DIRECTION_COUNT) + 1;
  const presentation = request.feature === 'product_main_image'
    ? resolveMainImageVariantPresentation(request)
    : undefined;
  const directive = presentation
    ? `${slot.directive} Presentation assignment: ${mainImagePresentationExecutionSummary(presentation.mode)}.`
    : slot.directive;
  const multiSceneLayout = request.feature === 'product_multi_scene'
    ? resolveMultiScenePresentationLayout(request)
    : undefined;
  const multiPanelMultiScene = multiSceneLayout
    ? isMultiPanelMultiSceneLayout(multiSceneLayout)
    : false;

  return {
    index: request.variantIndex,
    total: request.variantTotal,
    ...(cycle > 1 ? { cycle } : {}),
    directive,
    ...(presentation ? { presentation_mode: presentation.mode } : {}),
    single_image_only: true as const,
    ...(multiPanelMultiScene ? { multi_panel_scope_infographic: true as const } : {}),
    forbidden: multiPanelMultiScene
      ? [
          'single continuous photograph without panel dividers',
          'one-scene detail shot with cleaning tools as hero',
          'lifestyle staging instead of labeled scope panels',
        ]
      : [
          'triptych or multi-panel collage',
          'split-screen with 2/3/4 panels',
          'packing multiple use-case scenes into one image',
        ],
  };
}

function buildVariantPlainTextSuffix(
  feature: ImageFeature,
  variant: NonNullable<ProductSetJsonSpec['variant']>,
  scenePrompt: string | null,
  request: ImageTaskRequest,
) {
  const multiPanelMultiScene = feature === 'product_multi_scene'
    && isMultiPanelMultiSceneLayout(resolveMultiScenePresentationLayout(request));

  const lines = [
    VARIANT_PLAIN_TEXT_MARKER.trim(),
    `This request produces exactly ONE output image: variant ${variant.index} of ${variant.total} in the user batch.`,
    multiPanelMultiScene
      ? 'CRITICAL: Output exactly ONE labeled multi-panel application-scope infographic (grid or collage). Each panel must show a different applicable problem surface/state with a short English label. Never output a single continuous lifestyle photograph.'
      : 'CRITICAL: Output exactly ONE single continuous photograph of ONE scene. Never use triptych, split-screen, or multi-panel collage.',
    `Scene direction for this variant: ${variant.directive}`,
    multiPanelMultiScene
      ? 'This infographic must use a different panel problem mix, headline, or layout treatment from the other variants in the batch.'
      : 'This image must use a different physical sub-scene/environment from the other variants in the batch.',
  ];

  if (scenePrompt) {
    lines.push(
      `User scene scope: "${scenePrompt}". Stay within this category but pick a sub-location/surface/angle not used by the other variants.`,
    );
  } else if (feature === 'product_main_image') {
    lines.push('Choose a real applicable sub-scene that is clearly different from the other variants.');
    if (variant.presentation_mode === 'carousel_hero') {
      lines.push('This file MUST be carousel-ready AND show a concrete problem scene: visible dirty/problem surface plus product hero, without hand or spray/effect.');
    } else if (variant.presentation_mode === 'handheld_use') {
      lines.push('This file MUST show the hand holding the product beside/at the visible problem surface, ready to use, but MUST NOT show spray/mist/foam or other product-emitted effects.');
    } else if (variant.presentation_mode === 'effect_demo') {
      lines.push('This file is the ONLY file in the batch that may show concrete product action/effect on the problem surface (spray/pump/result). Other files must not repeat this effect.');
    } else if (variant.presentation_mode === 'lifestyle_scene') {
      lines.push('This file MUST show the problem surface/state clearly without hands or product-emitted effects.');
    }
  } else if (multiPanelMultiScene) {
    lines.push('Choose 4-6 distinct applicable problem surfaces/states derived from the SKU category (e.g. different stain types on car exterior).');
  }

  lines.push(
    multiPanelMultiScene
      ? 'Invalid outputs: single continuous photograph; cleaning tools hero shot; product bottle; repeating the same panel set as another variant.'
      : 'Invalid outputs: multi-panel collage; same wall/room/surface as another variant; headline-only change.',
  );

  return `\n\n${lines.join('\n')}\n`;
}

function buildBatchOutput(feature: ImageFeature, count: number) {
  const batchFeature = feature as ProductSetBatchFeature;
  return {
    count,
    require_distinct: true as const,
    meaning: 'API-level batch size: produce this many completely separate image files. Each file is one standalone final image.',
    delivery: 'The response may contain multiple separate image outputs. Never pack multiple batch variants into one canvas.',
    forbidden: [
      'stacking multiple variants as horizontal/vertical strips in one image',
      'collage or multi-panel grids of different batch variants',
      'triptych or 2/3/4-panel split-screen layout inside one output file',
      'showing multiple use-case locations in one file to demonstrate variety',
      'three-layer / multi-layer composites where each layer is a different variant',
      'repeating the same composition N times inside one frame to satisfy count',
      ...BATCH_DIVERSITY_FORBIDDEN,
    ],
    diversity: {
      min_changed_dimensions: 3,
      dimensions: [...BATCH_DIVERSITY_DIMENSIONS[batchFeature]],
      slots: buildDiversitySlots(batchFeature, count),
    },
  };
}

function buildDiversitySlots(feature: ProductSetBatchFeature, count: number) {
  const directives = BATCH_DIVERSITY_SLOT_DIRECTIVES[feature];
  return Array.from({ length: count }, (_, index) => {
    const slotIndex = index + 1;
    const directionIndex = index % BATCH_DIVERSITY_DIRECTION_COUNT;
    const cycle = Math.floor(index / BATCH_DIVERSITY_DIRECTION_COUNT) + 1;
    let directive = directives[directionIndex];
    if (cycle > 1) {
      directive = `${directive} Round ${cycle} of this direction: choose previously unused concrete sub-scenes, subjects, props, and compositions.`;
    }
    return { index: slotIndex, directive };
  });
}

function buildBatchPlainTextSuffix(
  feature: ImageFeature,
  batchOutput: NonNullable<ProductSetJsonSpec['batch_output']>,
  scenePrompt: string | null,
  request: ImageTaskRequest,
) {
  const multiPanelMultiScene = feature === 'product_multi_scene'
    && isMultiPanelMultiSceneLayout(resolveMultiScenePresentationLayout(request));

  const lines = [
    BATCH_PLAIN_TEXT_MARKER.trim(),
    `Generate exactly ${batchOutput.count} separate image files in this single request.`,
    multiPanelMultiScene
      ? 'CRITICAL: Each output file must be ONE labeled multi-panel application-scope infographic (grid or collage). Put multiple distinct problem surfaces/states INSIDE each file with panel dividers and English labels. Never output a single continuous lifestyle photograph.'
      : 'CRITICAL: Each output file must be ONE single continuous photograph of ONE scene only. Never put 2, 3, or 4 panels, triptychs, split-screens, or collage grids inside one file.',
    multiPanelMultiScene
      ? 'Batch diversity is ACROSS files (file 1 vs file 2): vary panel problem mix, headline, or layout — NOT by collapsing into one single-scene photo per file.'
      : 'Batch diversity is ACROSS files (file 1 vs file 2 vs file 3), NOT by packing multiple scenes into one file.',
    multiPanelMultiScene
      ? 'Each output file MUST use a visibly different panel problem set, headline, or layout treatment from the other files.'
      : 'Each output file MUST use a visibly different sub-scene/environment from the other files — NOT the same room, wall, surface, or background with different headline text.',
    `Compared to the other files in this batch, each file must differ in at least ${batchOutput.diversity.min_changed_dimensions} visual dimensions listed in batch_output.diversity.dimensions.${multiPanelMultiScene ? ' For multi-panel scope infographics, diversity means different panel content/headline/layout — not omitting the panel grid.' : ` This does NOT mean showing ${batchOutput.diversity.min_changed_dimensions} scenes inside one file.`}`,
  ];

  if (scenePrompt) {
    lines.push(
      `User scene scope: "${scenePrompt}". Every output file must stay within this scene category, but use a different sub-location, surface, object, angle, or lighting — never repeat the same physical setting.`,
    );
  } else if (feature === 'product_main_image') {
    lines.push(
      'Without a fixed user scene, choose different real applicable sub-scenes per file (e.g. different rooms, surfaces, indoor/outdoor contexts).',
    );
  } else if (multiPanelMultiScene) {
    lines.push(
      'Derive panel problems from the SKU category (e.g. for car cleaner: black spots, bug splatter, tree sap, bird droppings, water stains, grease on car exterior panels).',
    );
  }

  for (const slot of batchOutput.diversity.slots) {
    lines.push(
      multiPanelMultiScene
        ? `Output file ${slot.index} (one labeled multi-panel scope infographic): ${slot.directive}`
        : `Output file ${slot.index} (one single-scene photograph only): ${slot.directive}`,
    );
  }

  lines.push(
    multiPanelMultiScene
      ? 'Invalid batch outputs: single continuous photograph; one-scene detail with microfiber/tools; product bottle; same panel set repeated with only headline change.'
      : 'Invalid batch outputs: triptych or multi-panel collage inside one file; split-screen with multiple locations in one file; same physical scene repeated with only headline/text changes; same wall crack location; same background props and camera with recolor only.',
  );

  return `\n\n${lines.join('\n')}\n`;
}

function hasReferenceImage(request: ImageTaskRequest) {
  return (request.images ?? []).some((image) => image.role === 'reference');
}

function buildUserOverrides(
  scene: string | null,
  supplement: string | null,
  avoid: string | null,
) {
  const overrides: Record<string, unknown> = {
    priority: PRODUCT_SET_PRIORITY,
  };
  if (scene) {
    overrides.scene = scene;
  }
  if (supplement) {
    overrides.supplement = supplement;
  }
  if (avoid) {
    overrides.avoid = avoid;
  }
  return overrides;
}

function effectGuidance(mode: ProductEffectMode) {
  switch (mode) {
    case 'show':
      return 'Must clearly show the real action or result matching SKU physics; if the SKU is a spray/pump product, obey spray_physics and real openings only';
    case 'hide':
      return 'Show product and environment only; do not demonstrate action or result effects';
    default:
      return 'Decide automatically whether to show a concrete effect. Include spray/pump emission only if the SKU truly has a nozzle/pump/trigger; never invent spray geometry for non-spray products';
  }
}

function placementForLayout(layout: ComparisonLayout) {
  switch (layout) {
    case 'horizontal':
      return 'Center the enlarged product vertically across the left/right divider';
    case 'vertical':
      return 'Center the enlarged product horizontally across the top/bottom divider';
    case 'grid_2x2':
      return 'Integrate the product in the central comparison frame without covering either matched row';
    case 'grid_3x2':
      return 'Integrate the product in the central comparison frame without covering any matched row';
    default:
      return 'After choosing layout, center the enlarged product across the divider';
  }
}

export function resolveComparisonLayout(request: ImageTaskRequest): Exclude<ComparisonLayout, 'auto'> {
  if (request.comparisonLayout && request.comparisonLayout !== 'auto') {
    return request.comparisonLayout;
  }

  const index = Math.max(0, (request.variantIndex ?? 1) - 1);
  return AUTO_COMPARISON_LAYOUTS[index % AUTO_COMPARISON_LAYOUTS.length];
}

export function resolveComparisonEvidenceFraming(request: ImageTaskRequest): string {
  const index = Math.max(0, (request.variantIndex ?? 1) - 1);
  return COMPARISON_EVIDENCE_FRAMINGS[index % COMPARISON_EVIDENCE_FRAMINGS.length];
}

export function multiSceneLayoutPlan(layout: ResolvedMultiSceneLayout) {
  switch (layout) {
    case 'grid_2x2':
      return {
        panelCount: 4,
        layoutRule: '2 rows x 2 columns (4 equal cells) with clear dividers and concise caption strips; each cell shows a different applicable problem/stain/type on the target surface; infographic ecommerce scope chart, NOT one continuous photograph',
        headlineTreatment: 'Optional compact top headline with 3-8 English words; captions sit beneath each grid cell',
      };
    case 'grid_2x3':
      return {
        panelCount: 6,
        layoutRule: '2 rows x 3 columns (6 equal cells) with clear dividers and concise label bars; each cell shows a different applicable problem/stain/type on the target surface; infographic ecommerce scope chart, NOT one continuous photograph',
        headlineTreatment: 'Optional narrow side title band with short English labels beneath each grid cell',
      };
    case 'grid_3x2':
      return {
        panelCount: 6,
        layoutRule: '3 rows x 2 columns (6 equal cells) with clear dividers and label ribbons; each cell shows a different applicable problem/stain/type on the target surface; infographic ecommerce scope chart, NOT one continuous photograph',
        headlineTreatment: 'Optional compact corner headline with short English labels on each row',
      };
    case 'collage_4':
      return {
        panelCount: 4,
        layoutRule: '4 irregular but balanced panels with visible dividers; each panel shows a different applicable problem surface/state; ecommerce scope collage, NOT one continuous photograph',
        headlineTreatment: 'Optional short English headline in an open corner; use concise labels near each panel edge',
      };
    case 'collage_5':
      return {
        panelCount: 5,
        layoutRule: '5 irregular but balanced panels with visible dividers; each panel shows a different applicable problem surface/state; ecommerce scope collage, NOT one continuous photograph',
        headlineTreatment: 'Optional short English headline in a slim header; vary concise panel label placement',
      };
    case 'collage_6':
      return {
        panelCount: 6,
        layoutRule: '6 irregular but balanced panels with visible dividers; each panel shows a different applicable problem surface/state; ecommerce scope collage, NOT one continuous photograph',
        headlineTreatment: 'Optional short English headline in an open corner; use concise labels aligned to panel edges',
      };
    default:
      return {
        panelCount: 1,
        layoutRule: 'One complete target scene per image with readable foreground/midground/background detail; show a visible before-use problem state on the surface',
        headlineTreatment: 'Optional short English main title when helpful',
      };
  }
}

function styleForFeature(feature: ImageFeature, multiSceneLayout: MultiSceneLayout | ResolvedMultiSceneLayout = 'auto') {
  switch (feature) {
    case 'product_main_image':
      return 'US Temu functional ecommerce main image, commercial photography, clear benefit hierarchy';
    case 'product_comparison_image':
      return 'US Temu before/after comparison ecommerce image, credible commercial photography';
    case 'product_multi_scene':
      return isMultiPanelMultiSceneLayout(multiSceneLayout)
        ? 'US Temu application-scope infographic, labeled multi-panel collage of problem surfaces, commercial ecommerce layout'
        : 'US Temu multi-application-scope ecommerce image, realistic scene photography without product body';
    default:
      return 'US Temu ecommerce commercial photography';
  }
}

function environmentForFeature(
  feature: ImageFeature,
  scene: string | null,
  supplement: string | null,
) {
  if (feature === 'product_multi_scene') {
    return {
      location: supplement ?? 'AI chooses real applicable environments from SKU category',
      set: 'Only target surfaces, objects, spaces, or environments related to true product use',
      props: 'No product packaging props that reveal the SKU identity',
    };
  }

  return {
    location: scene ?? 'AI chooses a real use environment from SKU category',
    set: 'Support the product purpose without clutter',
    props: 'Only relevant supporting objects; no unrelated decoration piles',
  };
}

function cloneLook<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function trimOrNull(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function avoidExtra(value: string | undefined) {
  return Boolean(value?.trim());
}

function compactVisionFields<T extends Record<string, string | undefined>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => Boolean(entry?.trim())),
  );
}

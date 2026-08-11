import type {
  ComparisonIntensity,
  ComparisonLayout,
  ImageFeature,
  ImageTaskRequest,
  MultiSceneLayout,
  ProductEffectMode,
  ProductHandheldMode,
} from '../../../../src/shared/domain/imageFeatureApi.js';

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
  };
  handheld?: Record<string, unknown>;
  effect?: Record<string, unknown>;
  spray_physics?: Record<string, unknown>;
  copy?: Record<string, unknown>;
  panels?: Record<string, unknown>;
  product_overlay?: Record<string, unknown>;
  intensity?: ComparisonIntensity;
  intensity_guidance?: string;
  environment?: Record<string, unknown>;
};

const PRODUCT_SET_PRIORITY =
  'sku_lock > structured controls (handheld/effect/layout) > composition hard rules > variant directive and variant lighting/camera > user scene > supplement > avoid > free visual direction within allowed approaches';

const SKU_LOCK = {
  source: 'single primary SKU product photo as the only product identity reference',
  must_preserve: [
    'packaging structure',
    'exact product aspect ratio',
    'bottle/can/tube silhouette',
    'cap/nozzle/trigger geometry',
    'material, color, transparency, gloss',
    'primary label layout, brand, product name, capacity',
  ],
  forbidden: [
    'redesign packaging',
    'stretch, squash, thin, or widen the product',
    'change nozzle/cap/trigger structure',
    'alter brand, product name, or capacity',
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
] as const;

const HANDHELD_NEGATIVE = [
  'no free-standing product without a hand',
  'no product standing alone on a table or floor',
  'no missing thumb, fused fingers, extra fingers, or distorted hands',
  'no exaggerated product taller than the wrist in handheld shots',
] as const;

const VARIANT_LOOKS = [
  {
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
    directive: {
      product_main_image: 'Choose a clearly different ecommerce approach via sub-scene location and foreground layering. Do not only swap background or nudge the product.',
      product_comparison_image: 'Change the core problem sub-area, foreground prop layout, and color temperature. Do not rely on minor recolor, title-only, or product-shift differences.',
      product_multi_scene: 'Change space type, viewing distance/angle, and lighting mood. Output only target scenes/objects/surfaces/environments; no product or people.',
    },
  },
  {
    lighting: {
      key: {
        source: 'Window daylight',
        modifier: 'Sheer diffusion',
        position: 'Strong side key from camera left',
        effect: 'Directional shadows and deeper spatial separation',
      },
      fill: { type: 'Low ambient bounce', ratio: '1:5' },
      ambient: 'Natural',
      white_balance_k: '5600',
    },
    camera: {
      system: 'Digital camera',
      sensor: 'Full-frame',
      lens: { type: 'Prime', focal_length_mm: '35' },
      exposure: { iso: '200', aperture_f: '4.0', metering: 'Center-weighted' },
      focus: {
        target: 'Primary interaction surface and product face',
        depth_of_field: 'Shallow to medium with readable background context',
      },
      framing: {
        orientation: 'Square',
        crop: 'Three-quarter scene with product emphasis',
        angle: 'Slight high angle',
        composition: 'Leading lines into the hero product',
      },
    },
    color_grading: {
      look: 'Cool daylight commercial look coordinated with SKU palette',
      contrast: 'Medium-high',
      saturation: 'Slightly vibrant',
    },
    directive: {
      product_main_image: 'Choose a clearly different ecommerce approach via spatial depth, lighting direction/intensity, and background density. Do not only swap background or nudge the product.',
      product_comparison_image: 'Change spatial depth, lighting direction/intensity, and the visual form of the Before problem while After improves the same object and region.',
      product_multi_scene: 'Change primary surface/object type, background complexity, and space type. Output only target scenes/objects/surfaces/environments; no product or people.',
    },
  },
  {
    lighting: {
      key: {
        source: 'Warm practical lamp plus soft LED',
        modifier: 'Beauty dish or small softbox',
        position: 'Top-front key with mild rim separation',
        effect: 'Warm highlights and compact commercial contrast',
      },
      fill: { type: 'Warm reflector', ratio: '1:4' },
      ambient: 'Suppressed',
      white_balance_k: '4800',
    },
    camera: {
      system: 'Digital camera',
      sensor: 'Full-frame',
      lens: { type: 'Prime', focal_length_mm: '85' },
      exposure: { iso: '100', aperture_f: '8.0', metering: 'Spot on product label' },
      focus: {
        target: 'Brand label sharpness',
        depth_of_field: 'Deep enough to keep product fully sharp',
      },
      framing: {
        orientation: 'Square',
        crop: 'Tight hero product with selective environment',
        angle: 'Low angle',
        composition: 'Centered hero with compressed background',
      },
    },
    color_grading: {
      look: 'Warm commercial ecommerce look coordinated with SKU palette',
      contrast: 'Medium',
      saturation: 'Natural to warm',
    },
    directive: {
      product_main_image: 'Choose a clearly different ecommerce approach via color temperature, lighting direction/intensity, and background density. Do not only swap background or nudge the product.',
      product_comparison_image: 'Change foreground prop layout, lighting direction/intensity, and the visual form of the Before problem while After improves the same object and region.',
      product_multi_scene: 'Change viewing distance/angle, primary surface/object type, and background complexity. Output only target scenes/objects/surfaces/environments; no product or people.',
    },
  },
] as const;

const PRODUCT_SET_FEATURE_DIRECTION_COUNT = VARIANT_LOOKS.length;

export function isProductSetFeature(feature: ImageFeature) {
  return feature === 'product_main_image'
    || feature === 'product_comparison_image'
    || feature === 'product_multi_scene';
}

export function parseProductSetJsonPrompt(text: string): ProductSetJsonSpec {
  return JSON.parse(text) as ProductSetJsonSpec;
}

export function buildProductSetJsonPrompt(request: ImageTaskRequest): string {
  if (!isProductSetFeature(request.feature)) {
    throw new Error(`buildProductSetJsonPrompt does not support feature ${request.feature}`);
  }

  return `${JSON.stringify(buildProductSetSpec(request), null, 2)}\n`;
}

function buildProductSetSpec(request: ImageTaskRequest): ProductSetJsonSpec {
  const scene = request.feature === 'product_multi_scene' ? null : trimOrNull(request.scenePrompt);
  const supplement = trimOrNull(request.prompt);
  const avoid = trimOrNull(request.negativePrompt);
  const look = resolveVariantLook(request);
  const variant = buildVariant(request, look.directiveIndex);

  const draft: Record<string, unknown> = {
    task: request.feature,
    style: styleForFeature(request.feature),
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
  draft.lighting = cloneLook(look.lighting);
  draft.camera = cloneLook(look.camera);
  draft.color_grading = cloneLook(look.color_grading);
  draft.user_overrides = buildUserOverrides(scene, supplement, avoid);

  if (variant) {
    draft.variant = variant;
  }

  return orderedSpec(draft);
}

function buildMainImageFields(request: ImageTaskRequest) {
  const handheldMode: ProductHandheldMode = request.productHandheldMode ?? 'not_handheld';
  const effectMode: ProductEffectMode = request.productEffectMode ?? 'auto';
  const isHandheld = handheldMode === 'handheld';

  const fields: Record<string, unknown> = {
    handheld: isHandheld
      ? {
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
      mode: effectMode,
      guidance: effectGuidance(effectMode),
    },
    composition: {
      strategy: 'free_within_controls',
      product_required: true,
      hand_required: isHandheld,
      goal: 'Within about 3 seconds, show what the product is, where it is used, what problem it solves, and what result it delivers',
      allowed_approaches: isHandheld
        ? [
            'handheld real usage',
            'handheld usage process',
            'handheld pain-point close-up',
            'handheld action/effect demonstration',
            'handheld lifestyle use',
          ]
        : [
            'real usage scene',
            'usage process',
            'pain-point close-up',
            'action/effect demonstration',
            'lifestyle placement',
            'before-after feeling within a single main image when useful',
          ],
      forbidden_approaches: isHandheld
        ? [
            'no hand in frame',
            'free-standing bottle on table',
            'table-top product only without grip',
            'product standing alone',
          ]
        : [
            'handheld use',
            'visible holding hand',
          ],
      note: isHandheld
        ? 'Handheld is a hard structured control. Free composition only chooses HOW the hand holds/uses the SKU, never WHETHER a hand appears.'
        : 'Do not force one non-handheld template. Choose the strongest commercial approach for this SKU and scene; batch diversity is controlled only by variant index/total.',
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
      ...(isHandheld
        ? [
            'A real hand must appear and hold the SKU',
            'Correct hand anatomy with visible thumb',
            'Product bottom does not extend past the wrist',
          ]
        : [
            'No holding hand in frame',
          ]),
      'English headline readable in 3 seconds',
      'No small icon selling-point UI',
    ],
    negative_prompt: [
      ...MAIN_NEGATIVE,
      ...(isHandheld ? HANDHELD_NEGATIVE : ['no holding hand', 'no handheld grip']),
    ],
  };

  if (effectMode === 'show') {
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

  return fields;
}

function buildComparisonFields(request: ImageTaskRequest) {
  const layout: ComparisonLayout = request.comparisonLayout ?? 'auto';
  const intensity: ComparisonIntensity = request.comparisonIntensity ?? 'medium';
  const showProduct = request.showProduct !== false;

  const fields: Record<string, unknown> = {
    composition: {
      type: 'single_scene_before_after',
      layout,
      layout_rules: {
        auto: 'Choose horizontal or vertical based on aspect ratio and subject',
        horizontal: 'BEFORE left, AFTER right',
        vertical: 'BEFORE top, AFTER bottom',
      }[layout],
      invariant: 'Before and After keep the same scene, object, camera, scale, material, and structure',
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
      'no multi-stage process grids',
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
  const layout: MultiSceneLayout = request.multiSceneLayout ?? 'single';

  const fields: Record<string, unknown> = {
    composition: {
      focus: 'application scope: objects, materials, locations, environments',
      layout,
      layout_rules: {
        single: 'One complete target scene per image with readable foreground/midground/background detail',
        collage: 'Divide canvas into 4 irregular panels with at least 2 different panel aspect ratios and clear borders; each panel a different applicable scene',
        grid: '2x2 equal cells with clear dividers; each cell a different applicable scene; do not erase grid borders with near-identical fills',
      }[layout],
      sku_in_frame: false,
      people_allowed: false,
      note: 'SKU photo is only for recognizing category and true use cases; never render the product body',
    },
    copy: {
      optional_title: 'short English main title allowed when helpful',
      panel_labels: 'short English scene names allowed',
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
      'Scenes are clearly different and truly relevant to the product use case',
      'Readable commercial layout without clutter',
    ],
    negative_prompt: [
      'no SKU product body',
      'no product packaging',
      'no branded bottle or recognizable product instance',
      'no people, body, face, hands, or handheld use',
      'no weak/irrelevant filler scenes',
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
    'handheld',
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

function resolveVariantLook(request: ImageTaskRequest) {
  const hasBatch = request.variantIndex !== undefined
    && request.variantTotal !== undefined
    && request.variantTotal > 1;
  const directiveIndex = hasBatch
    ? (request.variantIndex! - 1) % PRODUCT_SET_FEATURE_DIRECTION_COUNT
    : 0;
  return {
    directiveIndex,
    ...VARIANT_LOOKS[directiveIndex],
  };
}

function buildVariant(request: ImageTaskRequest, directiveIndex: number) {
  if (request.variantIndex === undefined || request.variantTotal === undefined) {
    return undefined;
  }
  if (request.variantTotal <= 1) {
    return undefined;
  }

  const cycle = Math.floor((request.variantIndex - 1) / PRODUCT_SET_FEATURE_DIRECTION_COUNT) + 1;
  const featureKey = request.feature as 'product_main_image' | 'product_comparison_image' | 'product_multi_scene';
  let directive: string = VARIANT_LOOKS[directiveIndex].directive[featureKey];
  if (cycle > 1) {
    directive = `${directive} This is cycle/round ${cycle} of that direction; choose previously unused concrete sub-scenes, subjects, and compositions.`;
  }

  return {
    index: request.variantIndex,
    total: request.variantTotal,
    cycle,
    directive,
  };
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
    default:
      return 'After choosing layout, center the enlarged product across the divider';
  }
}

function styleForFeature(feature: ImageFeature) {
  switch (feature) {
    case 'product_main_image':
      return 'US Temu functional ecommerce main image, commercial photography, clear benefit hierarchy';
    case 'product_comparison_image':
      return 'US Temu before/after comparison ecommerce image, credible commercial photography';
    case 'product_multi_scene':
      return 'US Temu multi-application-scope ecommerce image, realistic scene photography without product body';
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

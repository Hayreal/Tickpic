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
    'foreground prop layout and density',
    'color temperature and tonal mood',
    'spatial depth and background layering',
    'lighting direction and shadow coverage',
    'visual form of the Before problem state',
  ],
  product_multi_scene: [
    'space type and environment category',
    'primary surface or object type',
    'viewing distance and camera angle',
    'lighting mood and time-of-day feel',
    'background complexity and density',
  ],
};

const BATCH_DIVERSITY_SLOT_DIRECTIVES: Record<ProductSetBatchFeature, readonly string[]> = {
  product_main_image: [
    'Use a distinct real-use sub-scene/environment (different room, surface, or indoor/outdoor location). Change sub-scene location, color temperature, and foreground layering. Same repair wall with different headline text is invalid.',
    'Use a different sub-scene/environment from output file 1 (not the same wall, room, surface, or background objects). Change spatial depth, lighting direction/intensity, and background density. Reusing the same crack-repair location is invalid.',
    'Use a third distinct sub-scene/environment from output files 1-2. Change product scale/position, headline layout, and camera distance/angle. Any output that repeats the same physical scene as another file is invalid.',
  ],
  product_comparison_image: [
    'Change the core problem sub-area, foreground prop layout, and color temperature. Do not rely on minor recolor, title-only, or product-shift differences.',
    'Change spatial depth, lighting direction/intensity, and the visual form of the Before problem while After improves the same object and region.',
    'Change foreground prop layout, lighting direction/intensity, and problem presentation while keeping single-scene Before/After consistency.',
  ],
  product_multi_scene: [
    'Change space type, viewing distance/angle, and lighting mood. Output only target scenes/objects/surfaces/environments; no product or people.',
    'Change primary surface/object type, background complexity, and space type. Output only target scenes/objects/surfaces/environments; no product or people.',
    'Change viewing distance/angle, primary surface/object type, and background complexity. Output only target scenes/objects/surfaces/environments; no product or people.',
  ],
};

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

export function buildProductSetJsonPrompt(request: ImageTaskRequest): string {
  if (!isProductSetFeature(request.feature)) {
    throw new Error(`buildProductSetJsonPrompt does not support feature ${request.feature}`);
  }

  const spec = buildProductSetSpec(request);
  const json = JSON.stringify(spec, null, 2);
  const scenePrompt = request.feature === 'product_multi_scene' ? null : trimOrNull(request.scenePrompt);
  const suffix = spec.variant
    ? buildVariantPlainTextSuffix(request.feature, spec.variant, scenePrompt)
    : spec.batch_output
      ? buildBatchPlainTextSuffix(request.feature, spec.batch_output, scenePrompt)
      : '';
  return suffix ? `${json}${suffix}` : `${json}\n`;
}

function buildProductSetSpec(request: ImageTaskRequest): ProductSetJsonSpec {
  const scene = request.feature === 'product_multi_scene' ? null : trimOrNull(request.scenePrompt);
  const supplement = trimOrNull(request.prompt);
  const avoid = trimOrNull(request.negativePrompt);

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

function buildMainImageFields(request: ImageTaskRequest) {
  const handheldMode: ProductHandheldMode = request.productHandheldMode ?? 'not_handheld';
  const effectMode: ProductEffectMode = request.productEffectMode ?? 'auto';
  const isHandheld = handheldMode === 'handheld';
  const hasReference = hasReferenceImage(request);

  const fields: Record<string, unknown> = {
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
      note: isHandheld
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
      one_pair_only: 'Each output image contains exactly one BEFORE/AFTER pair. Never stack multiple comparison pairs as layers or strips in the same image.',
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
    'handheld_reference',
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

  return {
    index: request.variantIndex,
    total: request.variantTotal,
    ...(cycle > 1 ? { cycle } : {}),
    directive: slot.directive,
    single_image_only: true as const,
    forbidden: [
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
) {
  const lines = [
    VARIANT_PLAIN_TEXT_MARKER.trim(),
    `This request produces exactly ONE output image: variant ${variant.index} of ${variant.total} in the user batch.`,
    'CRITICAL: Output exactly ONE single continuous photograph of ONE scene. Never use triptych, split-screen, or multi-panel collage.',
    `Scene direction for this variant: ${variant.directive}`,
    'This image must use a different physical sub-scene/environment from the other variants in the batch.',
  ];

  if (scenePrompt) {
    lines.push(
      `User scene scope: "${scenePrompt}". Stay within this category but pick a sub-location/surface/angle not used by the other variants.`,
    );
  } else if (feature === 'product_main_image') {
    lines.push('Choose a real applicable sub-scene that is clearly different from the other variants.');
  }

  lines.push(
    'Invalid outputs: multi-panel collage; same wall/room/surface as another variant; headline-only change.',
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
) {
  const lines = [
    BATCH_PLAIN_TEXT_MARKER.trim(),
    `Generate exactly ${batchOutput.count} separate image files in this single request.`,
    'CRITICAL: Each output file must be ONE single continuous photograph of ONE scene only. Never put 2, 3, or 4 panels, triptychs, split-screens, or collage grids inside one file.',
    'Batch diversity is ACROSS files (file 1 vs file 2 vs file 3), NOT by packing multiple scenes into one file.',
    'Each output file MUST use a visibly different sub-scene/environment from the other files — NOT the same room, wall, surface, or background with different headline text.',
    `Compared to the other files in this batch, each file must differ in at least ${batchOutput.diversity.min_changed_dimensions} visual dimensions listed in batch_output.diversity.dimensions. This does NOT mean showing ${batchOutput.diversity.min_changed_dimensions} scenes inside one file.`,
  ];

  if (scenePrompt) {
    lines.push(
      `User scene scope: "${scenePrompt}". Every output file must stay within this scene category, but use a different sub-location, surface, object, angle, or lighting — never repeat the same physical setting.`,
    );
  } else if (feature === 'product_main_image') {
    lines.push(
      'Without a fixed user scene, choose different real applicable sub-scenes per file (e.g. different rooms, surfaces, indoor/outdoor contexts).',
    );
  }

  for (const slot of batchOutput.diversity.slots) {
    lines.push(`Output file ${slot.index} (one single-scene photograph only): ${slot.directive}`);
  }

  lines.push(
    'Invalid batch outputs: triptych or multi-panel collage inside one file; split-screen with multiple locations in one file; same physical scene repeated with only headline/text changes; same wall crack location; same background props and camera with recolor only.',
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

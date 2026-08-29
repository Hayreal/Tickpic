import { describe, expect, it } from 'vitest';
import * as productSetPrompt from '../productSetJsonPrompt';
import { buildProductSetExecutionPromptsFromVision, buildProductSetJsonPrompt, parseProductSetJsonPrompt } from '../productSetJsonPrompt';

const MULTI_IMAGE_BATCH_OUTPUT = {
  meaning: 'API-level batch size: produce this many completely separate image files. Each file is one standalone final image.',
  delivery: 'The response may contain multiple separate image outputs. Never pack multiple batch variants into one canvas.',
  forbidden: expect.arrayContaining([
    'stacking multiple variants as horizontal/vertical strips in one image',
    'collage or multi-panel grids of different batch variants',
    'three-layer / multi-layer composites where each layer is a different variant',
    'repeating the same composition N times inside one frame to satisfy count',
    'recolor-only changes',
    'headline-only changes',
  ]),
} as const;

function expectBatchOutput(count: number) {
  return expect.objectContaining({
    count,
    require_distinct: true,
    ...MULTI_IMAGE_BATCH_OUTPUT,
    diversity: expect.objectContaining({
      min_changed_dimensions: 3,
      dimensions: expect.any(Array),
      slots: expect.arrayContaining([
        expect.objectContaining({ index: 1, directive: expect.any(String) }),
      ]),
    }),
  });
}

describe('productSetJsonPrompt', () => {
  it('renders a compact natural-language main-image execution prompt', () => {
    const renderer = (productSetPrompt as {
      buildProductSetExecutionPrompt?: (request: Record<string, unknown>) => string;
    }).buildProductSetExecutionPrompt;

    expect(renderer).toBeTypeOf('function');

    const prompt = renderer!({
      feature: 'product_main_image',
      aspectRatio: '1:1',
      productHandheldMode: 'not_handheld',
      productEffectMode: 'hide',
      scenePrompt: 'a real category-specific use setting',
      prompt: 'premium but credible',
      negativePrompt: 'unrelated filler props',
      variantIndex: 1,
      variantTotal: 3,
    });

    expect(prompt).not.toMatch(/^\s*\{/);
    expect(prompt).toContain('Create one 1:1 US Temu functional ecommerce main image, commercial photography, clear benefit hierarchy for US Temu ecommerce.');
    expect(prompt).toContain('Create one coherent ecommerce main-image scene');
    expect(prompt).not.toMatch(/[\u4e00-\u9fff]/);
    expect(prompt).not.toContain('"sku_lock"');
    expect(prompt).not.toContain('--- VARIANT DIRECTIVE');
    expect(prompt).toContain('Use the supplied SKU as the only product identity reference.');
    expect(prompt).toContain('actual use target');
    expect(prompt).toContain('a real category-specific use setting');
    expect(prompt).toContain('premium but credible');
    expect(prompt).toContain('unrelated filler props');
  });

  it('renders hard hand anatomy and scale constraints for handheld main images', () => {
    const prompt = productSetPrompt.buildProductSetExecutionPrompt({
      feature: 'product_main_image',
      productHandheldMode: 'handheld',
      productEffectMode: 'hide',
      images: [
        { role: 'product', path: '/authorized/input/product.png' },
        { role: 'reference', path: '/authorized/resources/product/handheld-spray-side-press.png' },
      ],
    });

    expect(prompt).toContain('all 5 fingers');
    expect(prompt).toContain('thumb must be visible');
    expect(prompt).toContain('natural real-hand-to-product scale');
    expect(prompt).toContain('no tiny hand with giant product');
  });

  it('renders real actuator and protective-cap constraints for spray effects', () => {
    const prompt = productSetPrompt.buildProductSetExecutionPrompt({
      feature: 'product_main_image',
      productHandheldMode: 'handheld',
      productEffectMode: 'show',
    });

    expect(prompt).toContain('remove any removable protective cap before spraying');
    expect(prompt).toContain('never spray through a cap');
    expect(prompt).toContain('real nozzle orifice only');
    expect(prompt).toContain('wrong nozzle/cap/trigger geometry');
  });

  it('keeps effect demonstrations category-appropriate for non-spray products', () => {
    const prompt = productSetPrompt.buildProductSetExecutionPrompt({
      feature: 'product_main_image',
      productHandheldMode: 'handheld',
      productEffectMode: 'show',
      scenePrompt: 'apply beeswax paste from a wide-mouth jar to a wooden table',
    });

    expect(prompt).toContain('real category-appropriate use action or visible after-use result');
    expect(prompt).toContain('Never invent spray, mist, or a nozzle for a non-spray product');
    expect(prompt).toContain('Only if the SKU truly has a spray nozzle, pump, trigger, or dispensing orifice');
    expect(prompt).not.toContain('Spray mechanics:');
  });

  it('renders a zero-CJK visible-copy constraint for overseas ecommerce images', () => {
    const prompt = productSetPrompt.buildProductSetExecutionPrompt({
      feature: 'product_main_image',
    });

    expect(prompt).toContain('Do not render any Chinese, Han, or other CJK characters anywhere');
    expect(prompt).toContain('omit optional copy rather than use non-English text');
  });

  it.each(['product_main_image', 'product_comparison_image', 'product_multi_scene'] as const)(
    'requires every visible capacity to use the NET: prefix for %s',
    (feature) => {
      const prompt = productSetPrompt.buildProductSetExecutionPrompt({ feature });

      expect(prompt).toContain('Every visible capacity must start with the exact prefix "NET:".');
    },
  );

  it('renders vision-merged execution variants as natural language', () => {
    const [prompt] = buildProductSetExecutionPromptsFromVision({
      feature: 'product_main_image',
      count: 1,
      scenePrompt: 'a real category-specific use setting',
    }, {
      instructions: [{
        index: 1,
        problem_surface: 'the actual target surface',
        problem_state: 'a visible pre-use problem state',
        environment: { location: 'a real use location' },
        composition_directive: 'place the product beside the target',
        variant_directive: 'use a distinct camera angle',
        headline_suggestion: 'Clear Result',
      }],
    });

    expect(prompt).not.toMatch(/^\s*\{/);
    expect(prompt).toContain('a real use location');
    expect(prompt).toContain('the actual target surface');
    expect(prompt).toContain('place the product beside the target');
    expect(prompt).toContain('Clear Result');
  });

  it.each([
    [1, 'show BEFORE on the left and AFTER on the right', 'Use a tight macro evidence crop'],
    [2, 'show BEFORE above and AFTER below', 'Use a contextual medium-distance evidence crop'],
    [3, 'use two rows, each with a matched BEFORE-left and AFTER-right pair', 'Use an edge-to-edge material-detail evidence crop'],
    [4, 'use three rows, each with a matched BEFORE-left and AFTER-right pair', 'Use a wider object-context evidence crop'],
  ])('rotates auto comparison layout and evidence framing for variant %i', (variantIndex, expectedLayout, expectedFraming) => {
    const renderer = (productSetPrompt as {
      buildProductSetExecutionPrompt?: (request: Record<string, unknown>) => string;
    }).buildProductSetExecutionPrompt;

    const prompt = renderer!({
      feature: 'product_comparison_image',
      comparisonLayout: 'auto',
      showProduct: true,
      variantIndex,
      variantTotal: 4,
    });

    expect(prompt).toContain(expectedLayout);
    expect(prompt).toContain(expectedFraming);
    expect(prompt).toContain('one readable foreground product layer integrated with the comparison frame');
    expect(prompt).toContain('unrelated display surfaces or filler props');
    expect(prompt).toContain('Do not add towels, brushes, cleaning tools, or accessory props');
  });

  it.each([
    [1, 'four-cell 2x2 grid'],
    [2, 'six-cell 2x3 grid'],
    [3, 'six-cell 3x2 grid'],
  ])('varies multi-scene grid geometry for variant %i', (variantIndex, expectedLayout) => {
    const renderer = (productSetPrompt as {
      buildProductSetExecutionPrompt?: (request: Record<string, unknown>) => string;
    }).buildProductSetExecutionPrompt;

    const prompt = renderer!({
      feature: 'product_multi_scene',
      multiSceneLayout: 'grid',
      variantIndex,
      variantTotal: 3,
    });

    expect(prompt).toContain(expectedLayout);
  });

  it('returns parseable JSON for a main-image handheld spray request', () => {
    const text = buildProductSetJsonPrompt({
      feature: 'product_main_image',
      productHandheldMode: 'handheld',
      productEffectMode: 'show',
      scenePrompt: 'fixative spray on canvas',
      prompt: 'premium commercial look',
      negativePrompt: 'extra bottles',
      count: 3,
      aspectRatio: '1:1',
    });

    const spec = parseProductSetJsonPrompt(text);

    expect(spec.task).toBe('product_main_image');
    expect(spec.output.aspect_ratio).toBe('1:1');
    expect(spec.output.marketplace).toBe('US Temu ecommerce');
    expect(spec.sku_lock.source).toContain('single primary SKU');
    expect(spec.sku_lock.must_preserve).toEqual(expect.arrayContaining([
      'exact product aspect ratio',
      'cap/nozzle/trigger geometry',
    ]));
    expect(spec.composition.strategy).toBe('free_within_controls');
    expect(spec.composition.product_required).toBe(true);
    expect(spec.composition.hand_required).toBe(true);
    expect(spec.handheld.mode).toBe('handheld');
    expect(spec.handheld.required).toBe(true);
    expect(spec.handheld.rules).toEqual(expect.arrayContaining([
      expect.stringContaining('5 fingers'),
      expect.stringContaining('thumb must be visible'),
      expect.stringContaining('not extend past the wrist'),
    ]));
    expect(spec.spray_physics.spray_origin).toContain('nozzle');
    expect(spec.copy.headline).toEqual(expect.objectContaining({
      language: 'en',
      word_count: '3-7',
    }));
    expect(spec.negative_prompt).toEqual(expect.arrayContaining([
      expect.stringMatching(/icon|badge|selling point/i),
      expect.stringMatching(/Chinese/i),
    ]));
    expect(spec.quality_targets).toEqual(expect.arrayContaining([
      expect.stringMatching(/thumb/i),
      expect.stringMatching(/wrist/i),
    ]));
    expect(spec.user_overrides).toEqual({
      scene: 'fixative spray on canvas',
      supplement: 'premium commercial look',
      avoid: 'extra bottles',
      priority: expect.stringContaining('sku_lock'),
    });
    expect(spec.batch_output).toEqual(expectBatchOutput(3));
    expect(spec.variant).toBeUndefined();
  });

  it('uses handheld_reference when a reference image is attached', () => {
    const spec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      productHandheldMode: 'handheld',
      images: [
        { role: 'product', path: '/authorized/input/product.png' },
        { role: 'reference', path: '/authorized/resources/product/handheld-pump-foam.png' },
      ],
    }));

    expect(spec.handheld.reference_driven).toBe(true);
    expect(spec.handheld.rules).toBeUndefined();
    expect(spec.handheld_reference).toEqual(expect.objectContaining({
      source: 'attached reference image',
      apply: expect.arrayContaining(['hand grip', 'hand pose']),
    }));
    expect(spec.quality_targets).toEqual(expect.arrayContaining([
      expect.stringMatching(/match the reference image/i),
    ]));
  });

  it('makes handheld a hard requirement that cannot be escaped by free composition', () => {
    const spec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      productHandheldMode: 'handheld',
      productEffectMode: 'auto',
      count: 1,
    }));

    expect(spec.handheld.mode).toBe('handheld');
    expect(spec.handheld.required).toBe(true);
    expect(spec.composition.hand_required).toBe(true);
    expect(spec.composition.allowed_approaches).toEqual(expect.arrayContaining([
      expect.stringMatching(/handheld/i),
    ]));
    expect(spec.composition.allowed_approaches.join(' ')).not.toMatch(/lifestyle placement|free-standing|product on table alone/i);
    expect(spec.composition.forbidden_approaches).toEqual(expect.arrayContaining([
      expect.stringMatching(/no hand|free-standing|table-top product only/i),
    ]));
    expect(spec.quality_targets).toEqual(expect.arrayContaining([
      expect.stringMatching(/hand must appear|must be held by a real hand/i),
    ]));
    expect(spec.negative_prompt).toEqual(expect.arrayContaining([
      expect.stringMatching(/no free-standing product without a hand|no product standing alone/i),
    ]));
    expect(spec.user_overrides.priority).toMatch(/handheld/);
    expect(spec.batch_output).toBeUndefined();
  });

  it('assembles main-image JSON with hard controls before free visual fields and omits conflicting defaults', () => {
    const text = buildProductSetJsonPrompt({
      feature: 'product_main_image',
      productHandheldMode: 'handheld',
      productEffectMode: 'auto',
      count: 3,
      aspectRatio: '1:1',
    });
    const spec = parseProductSetJsonPrompt(text);
    const keys = Object.keys(spec);

    expect(keys.indexOf('sku_lock')).toBeLessThan(keys.indexOf('handheld'));
    expect(keys.indexOf('handheld')).toBeLessThan(keys.indexOf('composition'));
    expect(keys.indexOf('composition')).toBeLessThan(keys.indexOf('lighting'));
    expect(keys.indexOf('lighting')).toBeLessThan(keys.indexOf('batch_output'));
    expect(spec.spray_physics).toBeUndefined();
    expect(String(spec.effect.guidance)).toMatch(/do not demonstrate action or result effects/i);
    expect(spec.lighting.key.position).toMatch(/Front-side|Side|Back|Top/i);
    expect(spec.camera.lens.focal_length_mm).toMatch(/^\d+$/);
    expect(spec.camera.exposure.iso).toMatch(/^\d+$/);
    expect(spec.user_overrides).not.toHaveProperty('scene');
    expect(spec.user_overrides).not.toHaveProperty('supplement');
    expect(spec.user_overrides).not.toHaveProperty('avoid');
    expect(spec.user_overrides.priority).toMatch(/batch_output/);
  });

  it('includes spray_physics only when effect mode is show', () => {
    const autoSpec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      productEffectMode: 'auto',
    }));
    const showSpec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      productEffectMode: 'show',
    }));
    const hideSpec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      productEffectMode: 'hide',
    }));

    expect(autoSpec.spray_physics).toBeUndefined();
    expect(hideSpec.spray_physics).toBeUndefined();
    expect(showSpec.spray_physics.spray_origin).toMatch(/nozzle/i);
  });

  it('uses a stable default look instead of per-variant lighting and camera', () => {
    const one = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      count: 3,
    }));
    const two = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      count: 3,
      prompt: 'different supplement',
    }));

    expect(one.lighting).toEqual(two.lighting);
    expect(one.camera).toEqual(two.camera);
    expect(one.batch_output).toEqual(expectBatchOutput(3));
  });

  it('builds comparison JSON with enlarged foreground product when showProduct is true', () => {
    const spec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_comparison_image',
      comparisonLayout: 'horizontal',
      comparisonIntensity: 'heavy',
      showProduct: true,
      scenePrompt: 'stained bathroom tile',
      count: 2,
    }));

    expect(spec.task).toBe('product_comparison_image');
    expect(spec.composition.type).toBe('single_scene_before_after');
    expect(spec.composition.layout).toBe('horizontal');
    expect(spec.copy.allowed_labels).toEqual(['BEFORE', 'AFTER']);
    expect(spec.copy.forbidden).toEqual(expect.arrayContaining([
      expect.stringMatching(/benefit|selling|icon/i),
    ]));
    expect(spec.panels.sku_inside_panels).toBe(false);
    expect(spec.product_overlay.enabled).toBe(true);
    expect(spec.product_overlay.scale).toMatch(/larger|hero|enlarged/i);
    expect(spec.product_overlay.instances).toBe(1);
    expect(spec.intensity).toBe('heavy');
    expect(spec.user_overrides.scene).toBe('stained bathroom tile');
    expect(spec.batch_output).toEqual(expectBatchOutput(2));
  });

  it('disables product overlay when comparison showProduct is false', () => {
    const spec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_comparison_image',
      showProduct: false,
      comparisonLayout: 'vertical',
    }));

    expect(spec.product_overlay.enabled).toBe(false);
    expect(spec.panels.sku_inside_panels).toBe(false);
  });

  it('builds multi-scene JSON that forbids SKU and people', () => {
    const spec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_multi_scene',
      multiSceneLayout: 'grid',
      prompt: 'kitchen and bathroom surfaces',
      negativePrompt: 'marketing text',
      count: 2,
    }));

    expect(spec.task).toBe('product_multi_scene');
    expect(spec.composition.layout).toBe('grid_2x2');
    expect(spec.composition.format).toBe('labeled_multi_panel_scope_infographic');
    expect(spec.panels).toEqual(expect.objectContaining({
      required: true,
      min_distinct_scenes: 4,
    }));
    expect(spec.composition.sku_in_frame).toBe(false);
    expect(spec.composition.people_allowed).toBe(false);
    expect(spec.negative_prompt).toEqual(expect.arrayContaining([
      expect.stringMatching(/SKU|product packaging|branded bottle/i),
      expect.stringMatching(/people|hands|handheld/i),
      expect.stringMatching(/single continuous photograph/i),
    ]));
    expect(spec.user_overrides.supplement).toBe('kitchen and bathroom surfaces');
    expect(spec.user_overrides.avoid).toBe('marketing text');
    expect(spec.batch_output).toEqual(expectBatchOutput(2));
  });

  it('requires labeled multi-panel scope infographics for grid multi-scene batch prompts', () => {
    const prompt = buildProductSetJsonPrompt({
      feature: 'product_multi_scene',
      multiSceneLayout: 'grid',
      count: 2,
    });

    expect(prompt).toContain('--- BATCH DIVERSITY (mandatory) ---');
    expect(prompt).toContain('labeled multi-panel application-scope infographic');
    expect(prompt).toContain('one labeled multi-panel scope infographic');
    expect(prompt).not.toContain('Never put 2, 3, or 4 panels');
    expect(prompt).toMatch(/black spots|stain types on car exterior/i);
  });

  it('omits empty user override fields', () => {
    const spec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      prompt: '  ',
      negativePrompt: '',
      scenePrompt: '   ',
    }));

    expect(spec.user_overrides).not.toHaveProperty('scene');
    expect(spec.user_overrides).not.toHaveProperty('supplement');
    expect(spec.user_overrides).not.toHaveProperty('avoid');
    expect(spec.user_overrides.priority).toEqual(expect.any(String));
  });

  it('uses variant directives when variantIndex and variantTotal are provided without count', () => {
    const spec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      variantIndex: 4,
      variantTotal: 6,
    }));

    expect(spec.variant).toEqual(expect.objectContaining({
      index: 4,
      total: 6,
      single_image_only: true,
    }));
    expect(spec.batch_output).toBeUndefined();
  });

  it('assigns distinct batch diversity slots for main, comparison, and multi-scene features', () => {
    const main = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      count: 3,
    }));
    const comparison = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_comparison_image',
      count: 3,
    }));
    const multiScene = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_multi_scene',
      count: 2,
    }));

    for (const spec of [main, comparison, multiScene]) {
      expect(spec.batch_output?.diversity.min_changed_dimensions).toBe(3);
      expect(spec.batch_output?.diversity.dimensions.length).toBeGreaterThanOrEqual(5);
    }

    expect(main.batch_output?.diversity.slots).toHaveLength(3);
    expect(new Set(main.batch_output?.diversity.slots.map((slot) => slot.directive)).size).toBe(3);

    expect(comparison.batch_output?.diversity.slots).toHaveLength(3);
    expect(new Set(comparison.batch_output?.diversity.slots.map((slot) => slot.directive)).size).toBe(3);

    expect(multiScene.batch_output?.diversity.slots).toHaveLength(2);
    expect(multiScene.batch_output?.diversity.slots[0].directive).not.toBe(
      multiScene.batch_output?.diversity.slots[1].directive,
    );
  });

  it('adds a cycle note when batch count exceeds three diversity directions', () => {
    const spec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      count: 4,
    }));

    expect(spec.batch_output?.diversity.slots[3].directive).toMatch(/Round 2/i);
  });

  it('appends mandatory plain-text batch diversity instructions after JSON', () => {
    const prompt = buildProductSetJsonPrompt({
      feature: 'product_main_image',
      count: 3,
      scenePrompt: 'wall crack repair',
    });

    expect(prompt).toContain('--- BATCH DIVERSITY (mandatory) ---');
    expect(prompt).toContain('Generate exactly 3 separate image files');
    expect(prompt).toContain('CRITICAL: Each output file must be ONE single continuous photograph');
    expect(prompt).toContain('Batch diversity is ACROSS files');
    expect(prompt).toContain('Output file 1 (one single-scene photograph only):');
    expect(prompt).toMatch(/triptych|multi-panel collage inside one file/i);
    expect(prompt).toContain('NOT the same room, wall, surface, or background with different headline text');
    expect(prompt).toContain('User scene scope: "wall crack repair"');
    expect(prompt).toMatch(/same wall crack location/i);
    expect(parseProductSetJsonPrompt(prompt).batch_output?.count).toBe(3);
  });

  it('uses variant directives instead of batch_output when variantIndex is provided', () => {
    const prompt = buildProductSetJsonPrompt({
      feature: 'product_main_image',
      count: 1,
      variantIndex: 2,
      variantTotal: 3,
      scenePrompt: 'wall crack repair',
    });

    const spec = parseProductSetJsonPrompt(prompt);
    expect(spec.variant).toEqual(expect.objectContaining({
      index: 2,
      total: 3,
      single_image_only: true,
    }));
    expect(spec.batch_output).toBeUndefined();
    expect(prompt).toContain('--- VARIANT DIRECTIVE (mandatory) ---');
    expect(prompt).toContain('variant 2 of 3');
    expect(prompt).toContain('ONE single continuous photograph');
    expect(prompt).not.toContain('--- BATCH DIVERSITY (mandatory) ---');
  });

  it('requires handheld label orientation relative to the nozzle end', () => {
    const spec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      productHandheldMode: 'handheld',
      images: [
        { role: 'product', path: '/authorized/input/product.png' },
        { role: 'reference', path: '/authorized/resources/product/handheld-dropper-tilt.png' },
      ],
    }));

    expect(spec.sku_lock.must_preserve).toEqual(expect.arrayContaining([
      expect.stringMatching(/logo.*nozzle|nozzle.*logo/i),
    ]));
    expect(spec.handheld_reference?.preserve).toEqual(expect.arrayContaining([
      expect.stringMatching(/logo.*nozzle|nozzle.*logo/i),
    ]));
    expect(spec.quality_targets).toEqual(expect.arrayContaining([
      expect.stringMatching(/logo.*nozzle|nozzle.*logo/i),
    ]));
    expect(spec.negative_prompt).toEqual(expect.arrayContaining([
      expect.stringMatching(/mirrored label|upside-down label/i),
    ]));
  });

  it('leaves multi-image carousel roles unassigned before Vision plans the batch', () => {
    const spec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      count: 1,
      variantIndex: 1,
      variantTotal: 3,
    }));

    expect(spec.presentation).toBeUndefined();
    expect(spec.variant?.presentation_mode).toBeUndefined();
  });

  it('uses Vision-selected carousel roles instead of variant order', () => {
    const prompts = buildProductSetExecutionPromptsFromVision({
      feature: 'product_main_image',
      count: 3,
    }, {
      instructions: [
        { index: 1, presentation_mode: 'lifestyle_scene', handheld_required: false, show_effect: false },
        { index: 2, presentation_mode: 'before_after', handheld_required: false, show_effect: false },
        { index: 3, presentation_mode: 'handheld_use', handheld_required: true, show_effect: false },
      ],
    });

    expect(prompts[0]).toContain('lifestyle-use image');
    expect(prompts[1]).toContain('BEFORE and AFTER');
    expect(prompts[2]).toContain('handheld-use image');
  });

  it('merges vision instructions into per-variant execution prompts', () => {
    const prompts = buildProductSetExecutionPromptsFromVision({
      feature: 'product_main_image',
      count: 2,
      scenePrompt: 'wall crack repair',
    }, {
      instructions: [
        {
          index: 1,
          environment: { location: 'indoor laundry room wall' },
          variant_directive: 'close-up handheld spray on vertical drywall crack',
          headline_suggestion: 'Fix Cracks Fast',
        },
        {
          index: 2,
          environment: { location: 'garage concrete floor corner' },
          variant_directive: 'wide scene with product hero on floor crack',
          headline_suggestion: 'Seal Concrete Gaps',
        },
      ],
    });

    expect(prompts).toHaveLength(2);
    expect(prompts[0]).not.toMatch(/^\s*\{/);
    expect(prompts[0]).not.toContain('--- VARIANT DIRECTIVE');
    expect(prompts[0]).toContain('indoor laundry room wall');
    expect(prompts[0]).toContain('Fix Cracks Fast');
    expect(prompts[1]).toContain('garage concrete floor corner');
    expect(prompts[1]).toContain('Seal Concrete Gaps');
    expect(prompts[0]).not.toContain('--- BATCH DIVERSITY');
  });

  it('merges multi-scene panel_list from vision into execution prompts', () => {
    const prompts = buildProductSetExecutionPromptsFromVision({
      feature: 'product_multi_scene',
      multiSceneLayout: 'grid',
      count: 2,
    }, {
      instructions: [
        {
          index: 1,
          scope_headline: 'ALL THESE CAN BE REMOVED',
          panel_list: [
            { label: 'Black Spots', problem_surface: 'car hood', problem_state: 'speckled tar spots' },
            { label: 'Bug Splatter', problem_surface: 'car bumper', problem_state: 'dried insect residue' },
            { label: 'Tree Sap', problem_surface: 'car hood', problem_state: 'sticky sap film' },
            { label: 'Bird Droppings', problem_surface: 'car windshield', problem_state: 'white droppings' },
          ],
          composition_directive: '2x3 labeled grid with top headline banner',
        },
        {
          index: 2,
          scope_headline: 'MULTI SURFACE CLEAN',
          panel_list: [
            { label: 'Mold', problem_surface: 'shower tile grout', problem_state: 'dark mold spots' },
            { label: 'Soap Scum', problem_surface: 'glass door', problem_state: 'cloudy film' },
            { label: 'Hard Water', problem_surface: 'faucet', problem_state: 'white mineral buildup' },
            { label: 'Rust', problem_surface: 'metal fixture', problem_state: 'orange rust stains' },
            { label: 'Limescale', problem_surface: 'sink basin', problem_state: 'chalky deposits' },
            { label: 'Grime', problem_surface: 'countertop', problem_state: 'greasy residue' },
          ],
          composition_directive: '2x3 labeled grid with alternate headline color',
        },
      ],
    });

    expect(prompts[0]).not.toMatch(/^\s*\{/);
    expect(prompts[0]).toContain('Use a readable four-cell 2x2 grid');
    expect(prompts[0]).toContain('Black Spots (car hood: speckled tar spots)');
    expect(prompts[0]).toContain('ALL THESE CAN BE REMOVED');
  });

  it('applies vision handheld_required when productHandheldMode is auto', () => {
    const prompts = buildProductSetExecutionPromptsFromVision({
      feature: 'product_main_image',
      productHandheldMode: 'auto',
      productEffectMode: 'auto',
      count: 1,
      images: [
        { role: 'product', path: '/authorized/input/product.png' },
        { role: 'reference', path: '/authorized/resources/product/handheld-spray-side-press.png' },
      ],
    }, {
      instructions: [{
        index: 1,
        handheld_required: true,
        show_effect: false,
        composition_directive: 'handheld beside motorcycle helmet interior',
      }],
    });

    expect(prompts[0]).toContain('Show a natural hand directly using or holding the SKU beside the actual use target.');
    expect(prompts[0]).toContain('Match the supplied hand-reference grip and pose');
  });
});

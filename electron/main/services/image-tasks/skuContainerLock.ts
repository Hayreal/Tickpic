export type SkuContainerForm = 'jar' | 'bottle' | 'tube' | 'spray' | 'dropper' | 'other';
export type SkuContainerHeightTier = 'low' | 'medium' | 'high';

export interface SkuContainerLock {
  form: SkuContainerForm;
  heightTier?: SkuContainerHeightTier;
  shapeDescription: string;
}

const CONTAINER_FORMS = new Set<SkuContainerForm>(['jar', 'bottle', 'tube', 'spray', 'dropper', 'other']);
const HEIGHT_TIERS = new Set<SkuContainerHeightTier>(['low', 'medium', 'high']);

const LOW_JAR_SIGNAL = /\b(?:squat|low-profile|wide-mouth|diameter (?:is )?(?:equal to|greater than|>|≥)|width (?:is )?(?:equal to|greater than|>|≥)|visible diameter.*(?:greater|equal)|height-to-(?:width|diameter).{0,24}(?:0\.\d|1(?:\.\d)?)\s*:\s*1)\b/i;
const HIGH_JAR_SIGNAL = /\b(?:tall cylindrical|height (?:is )?(?:clearly )?(?:greater than|>|much (?:taller|longer) than)|height-to-(?:width|diameter).{0,24}(?:[2-9]\.\d|[2-9])\s*:\s*1)\b/i;

export function parseSkuContainerLock(raw: unknown): SkuContainerLock | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const record = raw as Record<string, unknown>;
  const form = record.form;
  const shapeDescription = record.shape_description ?? record.shapeDescription;
  if (typeof form !== 'string' || !CONTAINER_FORMS.has(form as SkuContainerForm)) {
    return undefined;
  }
  if (typeof shapeDescription !== 'string' || !shapeDescription.trim()) {
    return undefined;
  }

  const heightTierRaw = record.height_tier ?? record.heightTier;
  let heightTier: SkuContainerHeightTier | undefined;
  if (typeof heightTierRaw === 'string' && heightTierRaw.trim()) {
    if (!HEIGHT_TIERS.has(heightTierRaw as SkuContainerHeightTier)) {
      return undefined;
    }
    heightTier = heightTierRaw as SkuContainerHeightTier;
  }

  const lock: SkuContainerLock = {
    form: form as SkuContainerForm,
    ...(heightTier ? { heightTier } : {}),
    shapeDescription: shapeDescription.trim(),
  };

  if (lock.form === 'jar' && !lock.heightTier) {
    return undefined;
  }

  return normalizeSkuContainerLock(lock);
}

export function normalizeSkuContainerLock(lock: SkuContainerLock): SkuContainerLock {
  if (lock.form !== 'jar' || !lock.heightTier) {
    return lock;
  }

  const description = lock.shapeDescription;
  if (LOW_JAR_SIGNAL.test(description)) {
    return { ...lock, heightTier: 'low' };
  }
  if (HIGH_JAR_SIGNAL.test(description)) {
    return { ...lock, heightTier: 'high' };
  }
  return lock;
}

export function appendSkuContainerLockSuffix(prompt: string, lock?: SkuContainerLock): string {
  if (!lock) {
    return prompt;
  }

  const suffix = [
    'HARD CONTAINER GEOMETRY LOCK:',
    ...buildContainerLockLines(lock),
    'The output container silhouette must match Image 1 exactly; changing jar height tier or diameter-to-height ratio is a failure.',
  ].join(' ');

  const normalizedPrompt = prompt.trim();
  if (normalizedPrompt.includes('HARD CONTAINER GEOMETRY LOCK:')) {
    return normalizedPrompt;
  }
  return `${normalizedPrompt}\n\n${suffix}`;
}

export function buildContainerLockLines(lock: SkuContainerLock): string[] {
  const lines = [
    `Image 1 container form is locked to ${lock.form}: ${lock.shapeDescription}.`,
    'This container geometry overrides any conflicting creative plan wording.',
  ];

  if (lock.form === 'jar' && lock.heightTier) {
    lines.push(...jarHeightTierLines(lock.heightTier));
  }

  return lines;
}

function jarHeightTierLines(tier: SkuContainerHeightTier): string[] {
  switch (tier) {
    case 'low':
      return [
        'Jar height tier: low (squat wide-mouth paste jar). Preserve squat geometry: visible diameter must remain equal to or greater than height.',
        'Never elongate a low jar into a medium or tall jar, and never replace it with a bottle or tube silhouette.',
      ];
    case 'medium':
      return [
        'Jar height tier: medium. Preserve balanced jar geometry: height and diameter remain roughly similar.',
        'Never compress it into a squat low jar or stretch it into a tall high jar.',
      ];
    case 'high':
      return [
        'Jar height tier: high (tall cylindrical jar). Preserve tall geometry: visible height must remain clearly greater than diameter.',
        'Never compress a tall jar into a squat low jar or medium jar.',
      ];
    default:
      return [];
  }
}

export const SKU_CONTAINER_LOCK_VISION_RULES = [
  'Resolve container_lock once for the entire batch from Image 1 primary SKU only.',
  'container_lock is mandatory for every batch.',
  'Allowed form values: jar, bottle, tube, spray, dropper, other.',
  'For paste, cream, gel, salve, or putty in open or closed jars/cans (罐装膏), set form to "jar" and classify height_tier using Image 1 only:',
  '- low (矮罐): visible diameter is equal to or greater than body height, including squat wide-mouth jars where width clearly exceeds height.',
  '- medium (中罐): height is only slightly greater than diameter, with no strong squat or tall impression.',
  '- high (高罐): visible body height is clearly greater than diameter.',
  'If Image 1 width/diameter is equal to or greater than height, height_tier MUST be "low", never "medium" or "high".',
  'If Image 1 shows annotated dimensions where width exceeds height, copy those numbers into shape_description and set height_tier to "low".',
  'shape_description must be concrete English covering mouth width, open/closed state, lid or cap type, visible contents, shoulder/neck/base profile, and the exact height-to-diameter relationship.',
  'Never describe a squat jar as a bottle, tube, medium jar, or tall jar, and never omit height_tier for jar form.',
].join('\n');

export const SKU_CONTAINER_LOCK_JSON_SHAPE = '{"locked_copy":{"brand":"","product_name":"","capacity":""},"container_lock":{"form":"jar","height_tier":"low","shape_description":""},"instructions":[{"index":1,"prompt":"..."}]}';

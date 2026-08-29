import OpenAI from 'openai';
import { stripJsonFence } from '../../../../src/shared/domain/replaceProductExecutionPrompt.js';
import { logModelRequest, logModelResponse } from './modelRequestLogger.js';
import { buildOpenAIChatCompletionsUrl } from './modelRequestUrls.js';
import type { SkuLabelConstraintSpec } from './skuConstraintSpec.js';
import type { SkuHitMainConstraintSpec } from './skuHitMainConstraintSpec.js';

const HAN_CHARACTER_PATTERN = /\p{Script=Han}/u;
const OMIT_CAPACITY_PATTERN = /\b(?:do not add(?: any)?|without|omit|no|never add(?: any)?)\s+capacity\b/i;

export interface AssembleSkuPromptOptions {
  openai: OpenAI;
  model: string;
  baseUrl: string;
  feature: string;
  creativePlan: string;
  constraints: SkuLabelConstraintSpec | SkuHitMainConstraintSpec;
  renderFallback: () => string;
  abortSignal: AbortSignal;
}

export interface AssembleSkuPromptResult {
  prompt: string;
  assembled: boolean;
}

export async function assembleSkuExecutionPrompt(
  options: AssembleSkuPromptOptions,
): Promise<AssembleSkuPromptResult> {
  const fallbackPrompt = options.renderFallback();

  try {
    const messages = [
      { role: 'system' as const, content: buildAssemblerSystemPrompt(options.feature) },
      {
        role: 'user' as const,
        content: buildAssemblerUserText(options.creativePlan, options.constraints),
      },
    ];

    logModelRequest('instruction', {
      protocol: 'openai',
      url: buildOpenAIChatCompletionsUrl(options.baseUrl),
      model: options.model,
      feature: options.feature,
      stage: 'prompt-assembler',
      messages,
    });

    const response = await options.openai.chat.completions.create({
      model: options.model,
      messages,
      response_format: { type: 'json_object' },
    }, {
      signal: options.abortSignal,
    });

    logModelResponse('instruction', {
      protocol: 'openai',
      url: buildOpenAIChatCompletionsUrl(options.baseUrl),
      model: options.model,
      feature: options.feature,
      stage: 'prompt-assembler',
      response,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return { prompt: fallbackPrompt, assembled: false };
    }

    const parsed = JSON.parse(stripJsonFence(content)) as { execution_prompt?: unknown };
    if (typeof parsed.execution_prompt !== 'string' || !parsed.execution_prompt.trim()) {
      return { prompt: fallbackPrompt, assembled: false };
    }

    const prompt = parsed.execution_prompt.trim();
    if (!validateAssembledPrompt(prompt, options.constraints)) {
      return { prompt: fallbackPrompt, assembled: false };
    }

    return { prompt, assembled: true };
  } catch {
    return { prompt: fallbackPrompt, assembled: false };
  }
}

export function validateAssembledPrompt(
  prompt: string,
  constraints: SkuLabelConstraintSpec | SkuHitMainConstraintSpec,
): boolean {
  if (!prompt.trim() || HAN_CHARACTER_PATTERN.test(prompt)) {
    return false;
  }

  if (OMIT_CAPACITY_PATTERN.test(prompt)) {
    return false;
  }

  if ('locked_copy' in constraints) {
    const lockedCopy = constraints.locked_copy;
    if (lockedCopy.capacity && !prompt.includes(lockedCopy.capacity)) {
      return false;
    }
    if (lockedCopy.brand && !prompt.toLowerCase().includes(lockedCopy.brand.toLowerCase())) {
      return false;
    }
    if (lockedCopy.product_name && !prompt.includes(lockedCopy.product_name)) {
      return false;
    }
    if (constraints.feature === 'sku_replica' && !validateReplicaAssembledPrompt(prompt)) {
      return false;
    }
  } else {
    const fields = constraints.user_fields;
    if (fields.capacity && !prompt.includes(fields.capacity)) {
      return false;
    }
    if (fields.brand && !prompt.toLowerCase().includes(fields.brand.toLowerCase())) {
      return false;
    }
  }

  return prompt.length >= 120;
}

function validateReplicaAssembledPrompt(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  const hasReferenceAuthority = /reference label|images 2\+|reference artwork|sole visual authority|reference design system/.test(normalized);
  const forbidsSourceLabel = /source-label|source label|never keep source|replace the entire source label|no source-label/.test(normalized);
  const requiresReferenceStructure = /hero graphic|band structure|decorative language|reference layout|reference palette/.test(normalized);
  return hasReferenceAuthority && forbidsSourceLabel && requiresReferenceStructure;
}

function buildAssemblerSystemPrompt(feature: string): string {
  const lines = [
    'You are the execution-prompt assembler for a US ecommerce image-edit task.',
    'You receive a creative plan plus non-negotiable constraints.',
    'Return ONLY one JSON object: {"execution_prompt":"..."}.',
    'Merge them into one concise English instruction for an image editing model.',
    'Constraints always override conflicting creative plan wording.',
    'Remove duplicate rules, forbidden actions, and analysis language.',
    'Preserve every locked brand, product name, capacity, packaging lock, physics realism rule, and source-lock rule from constraints.',
    'Return English only.',
  ];

  if (feature === 'sku_replica') {
    lines.push(
      'For sku_replica, the execution prompt MUST state that Images 2+ are the sole visual authority for the new label.',
      'It MUST require replacing the entire source label design, reproducing the reference label layout, band structure, hero graphic, and decorative language faithfully.',
      'It MUST forbid keeping any source-label icons, palette bands, or category imagery.',
      'locked_copy overrides only text fields; all label visuals must come from the reference label.',
    );
  }

  return lines.join('\n');
}

function buildAssemblerUserText(
  creativePlan: string,
  constraints: SkuLabelConstraintSpec | SkuHitMainConstraintSpec,
): string {
  return [
    'Merge the creative plan and constraints into one executable English image-edit prompt.',
    JSON.stringify({
      creative_plan: creativePlan,
      constraints,
    }, null, 2),
  ].join('\n\n');
}

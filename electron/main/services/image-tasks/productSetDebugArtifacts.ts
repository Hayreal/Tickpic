import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ImageFeature, ImageTaskRecord } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ImageTaskPlan } from '../../../../src/shared/domain/imageTaskPlan.js';
import type { ProductSetVisionBatch } from '../../../../src/shared/domain/productSetVisionInstructions.js';
import type { ProductSetVisionInstructionResult } from './visionInstructionClient.js';

const DEBUG_MANIFEST = 'product-set-debug.json';
const VISION_RAW = 'vision-raw.json';
const VISION_BATCH = 'vision-batch.json';
const EXECUTION_PROMPT_PREFIX = 'execution-prompt-';

export interface ProductSetDebugManifest {
  version: 1;
  purpose: string;
  howToReport: string;
  taskId: string;
  feature: ImageFeature;
  featureLabel: string;
  count: number;
  generatedAt: string;
  completedAt?: string;
  models: {
    vision: string;
    execution: string;
    protocol: string;
  };
  files: {
    request: string;
    visionRaw: string;
    visionBatch: string;
    combinedInstruction: string;
    executionPrompts: string[];
    resultImages: string[];
    resultSummary: string;
  };
  outputs: Array<{
    index: number;
    visionInstruction: ProductSetVisionBatch['instructions'][number];
    executionPromptFile: string;
    executionPromptPreview: string;
    resultImage?: string;
  }>;
}

export interface WriteProductSetDebugArtifactsInput {
  outputDir: string;
  filePrefix: string;
  task: ImageTaskRecord;
  plan: ImageTaskPlan;
  visionResult: ProductSetVisionInstructionResult;
  requestJsonPath: string;
  imageInstructionPath: string;
  outputJsonPath: string;
}

export async function writeProductSetDebugArtifacts(
  input: WriteProductSetDebugArtifactsInput,
): Promise<{ manifestPath: string; manifest: ProductSetDebugManifest }> {
  await mkdir(input.outputDir, { recursive: true });

  const visionRawPath = path.join(input.outputDir, `${input.filePrefix}${VISION_RAW}`);
  const visionBatchPath = path.join(input.outputDir, `${input.filePrefix}${VISION_BATCH}`);
  const executionPromptPaths = await Promise.all(
    input.visionResult.executionPrompts.map(async (prompt, index) => {
      const filePath = path.join(
        input.outputDir,
        `${input.filePrefix}${EXECUTION_PROMPT_PREFIX}${index + 1}.txt`,
      );
      await writeFile(filePath, prompt, 'utf-8');
      return filePath;
    }),
  );

  await writeFile(visionRawPath, JSON.stringify({
    model: input.visionResult.visionModel,
    content: input.visionResult.rawContent,
    capturedAt: new Date().toISOString(),
  }, null, 2), 'utf-8');

  await writeFile(visionBatchPath, JSON.stringify(input.visionResult.batch, null, 2), 'utf-8');

  const manifest: ProductSetDebugManifest = {
    version: 1,
    purpose: '套图测试诊断包：视觉分析 → 逐张编辑提示词 → 出图结果的对照记录',
    howToReport: '出图不满意时，请将此目录下的 product-set-debug.json、vision-batch.json、对应 execution-prompt-N.txt 与 result-N 图片一并发给开发者定位提示词问题。',
    taskId: input.task.taskId,
    feature: input.task.feature,
    featureLabel: featureLabel(input.task.feature),
    count: input.plan.count,
    generatedAt: new Date().toISOString(),
    models: {
      vision: input.visionResult.visionModel,
      execution: input.plan.executionStage.model,
      protocol: input.plan.executionStage.protocol,
    },
    files: {
      request: input.requestJsonPath,
      visionRaw: visionRawPath,
      visionBatch: visionBatchPath,
      combinedInstruction: input.imageInstructionPath,
      executionPrompts: executionPromptPaths,
      resultImages: [],
      resultSummary: input.outputJsonPath,
    },
    outputs: input.visionResult.batch.instructions.map((instruction, index) => ({
      index: instruction.index,
      visionInstruction: instruction,
      executionPromptFile: executionPromptPaths[index]!,
      executionPromptPreview: previewText(input.visionResult.executionPrompts[index] ?? '', 600),
    })),
  };

  const manifestPath = path.join(input.outputDir, `${input.filePrefix}${DEBUG_MANIFEST}`);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  return { manifestPath, manifest };
}

export async function finalizeProductSetDebugManifest(
  manifestPath: string,
  resultImages: string[],
): Promise<ProductSetDebugManifest> {
  const raw = await readJsonFile(manifestPath) as ProductSetDebugManifest;
  const completed: ProductSetDebugManifest = {
    ...raw,
    completedAt: new Date().toISOString(),
    files: {
      ...raw.files,
      resultImages,
    },
    outputs: raw.outputs.map((output, index) => ({
      ...output,
      resultImage: resultImages[index],
    })),
  };

  await writeFile(manifestPath, JSON.stringify(completed, null, 2), 'utf-8');
  return completed;
}

export function resolveArtifactFilePrefix(task: ImageTaskRecord) {
  return task.request.outputBatchId?.trim()
    ? `${sanitizePathSegment(task.taskId)}-`
    : '';
}

function featureLabel(feature: ImageFeature) {
  switch (feature) {
    case 'product_main_image':
      return '主图';
    case 'product_comparison_image':
      return '对比图';
    case 'product_multi_scene':
      return '多场景图';
    default:
      return feature;
  }
}

function previewText(text: string, maxLength: number) {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength)}…`;
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function readJsonFile(filePath: string) {
  const { readFile } = await import('node:fs/promises');
  return JSON.parse(await readFile(filePath, 'utf-8')) as unknown;
}

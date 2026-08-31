import type { ImageTaskRecord } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ImageTaskPlan, ImageTaskRuntimeConfig } from '../../../../src/shared/domain/imageTaskPlan.js';
import { buildImageTaskPlan } from '../../../../src/shared/domain/imageTaskPlan.js';
import { buildExecutionPrompt } from './instructionPrompt.js';
import { isProductSetFeature } from './productSetJsonPrompt.js';
import { isSkuFeature } from './skuExecutionPrompt.js';
import { isSkuHitMainImageFeature, orderHitMainExecutionImages } from './skuHitMainImagePrompt.js';
import type {
  VisionInstructionClient,
  ProductSetVisionInstructionResult,
  SkuVisionInstructionResult,
  SkuHitMainVisionInstructionResult,
} from './visionInstructionClient.js';
import {
  finalizeProductSetDebugManifest,
  resolveArtifactFilePrefix,
  writeProductSetDebugArtifacts,
} from './productSetDebugArtifacts.js';
import type { ImageTaskExecutionResult, ImageTaskExecutor } from './imageTaskController.js';
import { getAppLogger } from '../logger/appLogger.js';

export interface GeneratedImageOutput {
  fileName: string;
  buffer: Uint8Array;
  mimeType: string;
}

export interface ImageExecutionModelResult {
  images: GeneratedImageOutput[];
  textNotes?: string[];
  warnings?: string[];
}

export interface ExecuteImageInput {
  task: ImageTaskRecord;
  plan: ImageTaskPlan;
  finalPrompt: string;
  abortSignal: AbortSignal;
}

export interface ImageTaskModelGateway {
  executeImage(input: ExecuteImageInput): Promise<ImageExecutionModelResult>;
  executeSingleImage(input: ExecuteImageInput): Promise<ImageExecutionModelResult>;
}

export interface SaveImageTaskArtifactsInput {
  task: ImageTaskRecord;
  plan: ImageTaskPlan;
  finalPrompt: string;
  generated: ImageExecutionModelResult;
}

export interface SavedImageTaskArtifacts {
  outputDir: string;
  images: string[];
  requestJsonPath: string;
  imageInstructionPath: string;
  outputJsonPath: string;
}

export interface ImageTaskArtifactBeginInput {
  task: ImageTaskRecord;
  plan: ImageTaskPlan;
  finalPrompt: string;
}

export interface ImageTaskArtifactSession {
  outputDir: string;
  requestJsonPath: string;
  imageInstructionPath: string;
  outputJsonPath: string;
  imagePaths: string[];
  appendImage(image: GeneratedImageOutput, index: number): Promise<string>;
  finalize(generated: ImageExecutionModelResult): Promise<SavedImageTaskArtifacts>;
}

export interface ImageTaskArtifactStore {
  begin(input: ImageTaskArtifactBeginInput): Promise<ImageTaskArtifactSession>;
  save(input: SaveImageTaskArtifactsInput): Promise<SavedImageTaskArtifacts>;
}

export interface CreateImageTaskExecutorOptions {
  runtimeConfig: ImageTaskRuntimeConfig;
  modelGateway: ImageTaskModelGateway;
  artifactStore: ImageTaskArtifactStore;
  visionInstructionClient?: VisionInstructionClient;
}

export function createImageTaskExecutor(options: CreateImageTaskExecutorOptions): ImageTaskExecutor {
  return async (task, abortSignal, onProgress) => {
    const logger = getAppLogger();
    const plan = buildImageTaskPlan(task.request, options.runtimeConfig);
    logger.info('image-task', '任务执行计划已生成', {
      taskId: task.taskId,
      feature: task.feature,
      count: plan.count,
      executionModel: plan.executionStage.model,
    });

    const isProductSet = isProductSetFeature(task.feature);
    const isSku = isSkuFeature(task.feature);
    const isHitMain = isSkuHitMainImageFeature(task.feature);
    const productSetVisionResult = isProductSet
      ? await resolveProductSetVisionResult({
        task,
        plan,
        abortSignal,
        visionInstructionClient: options.visionInstructionClient,
        logger,
      })
      : undefined;
    const skuVisionResult = isSku
      ? await resolveSkuVisionResult({
        task,
        plan,
        abortSignal,
        visionInstructionClient: options.visionInstructionClient,
        logger,
      })
      : undefined;
    const skuHitMainVisionResult = isHitMain
      ? await resolveSkuHitMainVisionResult({
        task,
        plan,
        abortSignal,
        visionInstructionClient: options.visionInstructionClient,
        logger,
      })
      : undefined;
    const visionPrompts = productSetVisionResult?.executionPrompts
      ?? skuVisionResult?.executionPrompts
      ?? skuHitMainVisionResult?.executionPrompts;
    const isVisionPromptTask = isProductSet || isSku || isHitMain;
    const finalPrompt = isVisionPromptTask
      ? visionPrompts!.join('\n\n--- NEXT OUTPUT ---\n\n')
      : buildExecutionPrompt(task.request, plan.mainPrompt);

    logger.info('image-task', '图片执行提示词已组装', {
      taskId: task.taskId,
      promptLength: finalPrompt.length,
      visionGenerated: isVisionPromptTask,
      promptCount: isVisionPromptTask ? visionPrompts!.length : 1,
    });

    const session = await options.artifactStore.begin({ task, plan, finalPrompt });
    let productSetDebugManifestPath: string | undefined;
    if (productSetVisionResult) {
      const debugArtifacts = await writeProductSetDebugArtifacts({
        outputDir: session.outputDir,
        filePrefix: resolveArtifactFilePrefix(task),
        task,
        plan,
        visionResult: productSetVisionResult,
        requestJsonPath: session.requestJsonPath,
        imageInstructionPath: session.imageInstructionPath,
        outputJsonPath: session.outputJsonPath,
      });
      productSetDebugManifestPath = debugArtifacts.manifestPath;
      logger.info('image-task', '套图测试诊断包已写入', {
        taskId: task.taskId,
        feature: task.feature,
        outputDir: session.outputDir,
        debugManifestPath: debugArtifacts.manifestPath,
        visionModel: productSetVisionResult.visionModel,
        executionModel: plan.executionStage.model,
        promptCount: productSetVisionResult.executionPrompts.length,
        files: debugArtifacts.manifest.files,
      });
    }

    logger.info('image-task', '产物目录已初始化', {
      taskId: task.taskId,
      outputDir: session.outputDir,
    });

    const generatedImages: GeneratedImageOutput[] = [];
    const textNotes: string[] = [];
    const warnings: string[] = [];

    onProgress?.({
      outputDir: session.outputDir,
      requestJsonPath: session.requestJsonPath,
      imageInstructionPath: session.imageInstructionPath,
      outputJsonPath: session.outputJsonPath,
      images: [],
      progress: { completed: 0, total: plan.count },
    });

    const ingestResult = async (result: ImageExecutionModelResult) => {
      if (result.textNotes?.length) {
        textNotes.push(...result.textNotes);
      }
      if (result.warnings?.length) {
        warnings.push(...result.warnings);
      }

      for (const image of result.images) {
        if (session.imagePaths.length >= plan.count) {
          return;
        }

        generatedImages.push(image);
        await session.appendImage(image, session.imagePaths.length);
        onProgress?.({
          outputDir: session.outputDir,
          requestJsonPath: session.requestJsonPath,
          imageInstructionPath: session.imageInstructionPath,
          outputJsonPath: session.outputJsonPath,
          images: [...session.imagePaths],
          progress: {
            completed: session.imagePaths.length,
            total: plan.count,
          },
        });
      }
    };

    if (isVisionPromptTask) {
      for (let index = 0; index < plan.count; index += 1) {
        const outputIndex = index + 1;
        const variantRequest = plan.count > 1
          ? { ...task.request, count: 1, variantIndex: outputIndex, variantTotal: plan.count }
          : task.request;
        const prompt = visionPrompts![index];
        const executionImages = isProductSet
          ? filterProductSetExecutionImages(
            plan.executionImages,
            productSetVisionResult?.executionHandheldReferenceRequired?.[index] === true,
          )
          : isHitMain
            ? orderHitMainExecutionImages(plan.executionImages)
            : isSku
              ? filterSkuLabelExecutionImages(plan.executionImages)
              : plan.executionImages;
        const variantPlan = plan.count > 1
          ? { ...plan, request: variantRequest, count: 1, executionImages }
          : { ...plan, executionImages };
        logger.info('image-task', `开始生成${isSku ? ' SKU' : isHitMain ? ' 爆款主图' : '套图'} ${outputIndex}/${plan.count}`, { taskId: task.taskId });
        logger.info('image-task', `${isSku ? 'SKU' : isHitMain ? '爆款主图' : '套图'}出图提示词`, {
          taskId: task.taskId,
          feature: task.feature,
          index: outputIndex,
          total: plan.count,
          promptPreview: prompt.slice(0, 400),
          executionPromptFile: `${resolveArtifactFilePrefix(task)}execution-prompt-${outputIndex}.txt`,
          executionImageCount: executionImages.length,
        });
        const result = await options.modelGateway.executeSingleImage({
          task: { ...task, request: variantRequest },
          plan: variantPlan,
          finalPrompt: prompt,
          abortSignal,
        });
        await ingestResult(result);
      }
    } else {
      for (let index = 0; index < plan.count; index += 1) {
        logger.info('image-task', `开始生成第 ${index + 1}/${plan.count} 张图片`, { taskId: task.taskId });
        const result = await options.modelGateway.executeSingleImage({
          task,
          plan,
          finalPrompt,
          abortSignal,
        });
        await ingestResult(result);
      }
    }

    logger.info('image-task', `已保存 ${session.imagePaths.length}/${plan.count} 张图片`, {
      taskId: task.taskId,
      completed: session.imagePaths.length,
    });

    if (generatedImages.length === 0) {
      throw new Error('image model returned no usable image output');
    }

    const generated: ImageExecutionModelResult = {
      images: generatedImages.slice(0, plan.count),
      textNotes: textNotes.length > 0 ? textNotes : undefined,
      warnings,
    };
    const artifacts = await session.finalize(generated);
    if (productSetDebugManifestPath) {
      const debugManifest = await finalizeProductSetDebugManifest(
        productSetDebugManifestPath,
        artifacts.images,
      );
      logger.info('image-task', '套图测试诊断包已完成', {
        taskId: task.taskId,
        debugManifestPath: productSetDebugManifestPath,
        outputCount: debugManifest.outputs.length,
        unsatisfiedReportHint: '出图不满意时，请把 product-set-debug.json、vision-batch.json、execution-prompt-N.txt 与 result-N 图片一并发给开发者。',
      });
    }
    logger.info('image-task', '任务产物已落盘', {
      taskId: task.taskId,
      outputDir: artifacts.outputDir,
      imageCount: artifacts.images.length,
    });

    return {
      model: plan.executionStage.model,
      protocol: plan.executionStage.protocol,
      outputDir: artifacts.outputDir,
      images: artifacts.images,
      progress: { completed: artifacts.images.length, total: plan.count },
      requestJsonPath: artifacts.requestJsonPath,
      imageInstructionPath: artifacts.imageInstructionPath,
      outputJsonPath: artifacts.outputJsonPath,
      textNotes: generated.textNotes,
      warnings: generated.warnings ?? [],
    } satisfies ImageTaskExecutionResult;
  };
}

async function resolveSkuVisionResult(input: {
  task: ImageTaskRecord;
  plan: ImageTaskPlan;
  abortSignal: AbortSignal;
  visionInstructionClient?: VisionInstructionClient;
  logger: ReturnType<typeof getAppLogger>;
}): Promise<SkuVisionInstructionResult> {
  if (!input.visionInstructionClient?.generateSkuInstructions) {
    throw new Error('SKU tasks require a configured vision instruction client');
  }

  input.logger.info('image-task', '开始生成 SKU 英文视觉提示词', {
    taskId: input.task.taskId,
    feature: input.task.feature,
    count: input.plan.count,
  });

  const result = await input.visionInstructionClient.generateSkuInstructions({
    task: input.task,
    plan: input.plan,
    abortSignal: input.abortSignal,
  });

  if (result.executionPrompts.length !== input.plan.count) {
    throw new Error(
      `vision model returned ${result.executionPrompts.length} SKU prompts, expected ${input.plan.count}`,
    );
  }

  input.logger.info('image-task', 'SKU 英文视觉提示词已生成', {
    taskId: input.task.taskId,
    promptCount: result.executionPrompts.length,
    visionModel: result.visionModel,
  });
  return result;
}

async function resolveSkuHitMainVisionResult(input: {
  task: ImageTaskRecord;
  plan: ImageTaskPlan;
  abortSignal: AbortSignal;
  visionInstructionClient?: VisionInstructionClient;
  logger: ReturnType<typeof getAppLogger>;
}): Promise<SkuHitMainVisionInstructionResult> {
  if (!input.visionInstructionClient?.generateSkuHitMainInstructions) {
    throw new Error('SKU hit-main tasks require a configured vision instruction client');
  }

  input.logger.info('image-task', '开始生成爆款主图英文视觉提示词', {
    taskId: input.task.taskId,
    feature: input.task.feature,
    count: input.plan.count,
  });

  const result = await input.visionInstructionClient.generateSkuHitMainInstructions({
    task: input.task,
    plan: input.plan,
    abortSignal: input.abortSignal,
  });

  if (result.executionPrompts.length !== input.plan.count) {
    throw new Error(
      `vision model returned ${result.executionPrompts.length} hit-main prompts, expected ${input.plan.count}`,
    );
  }

  input.logger.info('image-task', '爆款主图英文视觉提示词已生成', {
    taskId: input.task.taskId,
    promptCount: result.executionPrompts.length,
    visionModel: result.visionModel,
  });
  return result;
}

async function resolveProductSetVisionResult(input: {
  task: ImageTaskRecord;
  plan: ImageTaskPlan;
  abortSignal: AbortSignal;
  visionInstructionClient?: VisionInstructionClient;
  logger: ReturnType<typeof getAppLogger>;
}): Promise<ProductSetVisionInstructionResult> {
  if (!input.visionInstructionClient) {
    throw new Error('product-set tasks require a configured vision instruction client');
  }

  input.logger.info('image-task', '开始生成套图视觉指令', {
    taskId: input.task.taskId,
    feature: input.task.feature,
    count: input.plan.count,
  });

  const result = await input.visionInstructionClient.generateProductSetInstructions({
    task: input.task,
    plan: input.plan,
    abortSignal: input.abortSignal,
  });

  if (result.executionPrompts.length !== input.plan.count) {
    throw new Error(
      `vision model returned ${result.executionPrompts.length} prompts, expected ${input.plan.count}`,
    );
  }

  input.logger.info('image-task', '套图视觉指令已生成', {
    taskId: input.task.taskId,
    promptCount: result.executionPrompts.length,
    visionModel: result.visionModel,
    visionBatch: result.batch,
  });

  return result;
}

function filterSkuLabelExecutionImages(
  executionImages: ImageTaskPlan['executionImages'],
) {
  const sourceImages = executionImages.filter((image) => image.role === 'source');
  return sourceImages.length > 0 ? sourceImages : executionImages.slice(0, 1);
}

function filterProductSetExecutionImages(
  executionImages: ImageTaskPlan['executionImages'],
  requiresHandheldReference: boolean,
) {
  return requiresHandheldReference
    ? executionImages
    : executionImages.filter((image) => image.role !== 'reference');
}

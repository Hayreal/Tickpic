import type { ImageTaskRecord } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ImageTaskPlan, ImageTaskRuntimeConfig } from '../../../../src/shared/domain/imageTaskPlan.js';
import { buildImageTaskPlan } from '../../../../src/shared/domain/imageTaskPlan.js';
import { buildExecutionPrompt } from './instructionPrompt.js';
import type { ImageTaskExecutionResult, ImageTaskExecutor } from './imageTaskController.js';
import { getAppLogger } from '../logger/appLogger.js';
import { inspectGeneratedImage, outputDimensionWarning } from './generatedImageDimensions.js';

export interface GeneratedImageOutput {
  fileName: string;
  buffer: Uint8Array;
  mimeType: string;
  width?: number;
  height?: number;
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

    const finalPrompt = buildExecutionPrompt(task.request, plan.mainPrompt);
    logger.info('image-task', '图片执行提示词已组装', {
      taskId: task.taskId,
      promptLength: finalPrompt.length,
    });

    const session = await options.artifactStore.begin({ task, plan, finalPrompt });
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

    for (let index = 0; index < plan.count; index += 1) {
      logger.info('image-task', `开始生成第 ${index + 1}/${plan.count} 张图片`, { taskId: task.taskId });
      const result = await options.modelGateway.executeSingleImage({
        task,
        plan,
        finalPrompt,
        abortSignal,
      });

      if (result.textNotes?.length) {
        textNotes.push(...result.textNotes);
      }
      if (result.warnings?.length) {
        warnings.push(...result.warnings);
      }

      for (const [imageOffset, image] of result.images.entries()) {
        const actualDimensions = inspectGeneratedImage(image.buffer);
        const generatedImage = actualDimensions
          ? { ...image, ...actualDimensions }
          : image;
        const dimensionWarning = outputDimensionWarning(actualDimensions, plan.outputSpec);

        generatedImages.push(generatedImage);
        if (dimensionWarning) {
          warnings.push(dimensionWarning);
        }
        logger.info('image-task', '模型返回图片尺寸已检查', {
          taskId: task.taskId,
          target: plan.outputSpec && { width: plan.outputSpec.width, height: plan.outputSpec.height },
          actual: actualDimensions,
        });
        await session.appendImage(generatedImage, index + imageOffset);
      }

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
      logger.info('image-task', `第 ${index + 1}/${plan.count} 张图片已保存`, {
        taskId: task.taskId,
        completed: session.imagePaths.length,
      });
    }

    if (generatedImages.length === 0) {
      throw new Error('image model returned no usable image output');
    }

    const generated: ImageExecutionModelResult = {
      images: generatedImages,
      textNotes: textNotes.length > 0 ? textNotes : undefined,
      warnings,
    };
    const artifacts = await session.finalize(generated);
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

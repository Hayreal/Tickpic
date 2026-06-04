import type { ImageTaskRecord } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ImageTaskPlan, ImageTaskRuntimeConfig } from '../../../../src/shared/domain/imageTaskPlan.js';
import { buildImageTaskPlan } from '../../../../src/shared/domain/imageTaskPlan.js';
import type { ImageTaskExecutionResult, ImageTaskExecutor } from './imageTaskController.js';

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

export interface GenerateInstructionInput {
  task: ImageTaskRecord;
  plan: ImageTaskPlan;
  abortSignal: AbortSignal;
}

export interface ExecuteImageInput {
  task: ImageTaskRecord;
  plan: ImageTaskPlan;
  finalPrompt: string;
  abortSignal: AbortSignal;
}

export interface ImageTaskModelGateway {
  generateInstruction(input: GenerateInstructionInput): Promise<string>;
  executeImage(input: ExecuteImageInput): Promise<ImageExecutionModelResult>;
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

export interface ImageTaskArtifactStore {
  save(input: SaveImageTaskArtifactsInput): Promise<SavedImageTaskArtifacts>;
}

export interface CreateImageTaskExecutorOptions {
  runtimeConfig: ImageTaskRuntimeConfig;
  modelGateway: ImageTaskModelGateway;
  artifactStore: ImageTaskArtifactStore;
}

export function createImageTaskExecutor(options: CreateImageTaskExecutorOptions): ImageTaskExecutor {
  return async (task, abortSignal) => {
    const plan = buildImageTaskPlan(task.request, options.runtimeConfig);
    const finalPrompt = await options.modelGateway.generateInstruction({ task, plan, abortSignal });
    const generated = await options.modelGateway.executeImage({ task, plan, finalPrompt, abortSignal });
    const artifacts = await options.artifactStore.save({
      task,
      plan,
      finalPrompt,
      generated,
    });

    return {
      model: plan.executionStage.model,
      protocol: plan.executionStage.protocol,
      outputDir: artifacts.outputDir,
      images: artifacts.images,
      requestJsonPath: artifacts.requestJsonPath,
      imageInstructionPath: artifacts.imageInstructionPath,
      outputJsonPath: artifacts.outputJsonPath,
      textNotes: generated.textNotes,
      warnings: generated.warnings ?? [],
    } satisfies ImageTaskExecutionResult;
  };
}

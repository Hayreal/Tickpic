import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  GeneratedImageOutput,
  ImageExecutionModelResult,
  ImageTaskArtifactStore,
  SaveImageTaskArtifactsInput,
  SavedImageTaskArtifacts,
} from './imageTaskExecutor.js';

export interface ImageTaskArtifactSession {
  outputDir: string;
  requestJsonPath: string;
  imageInstructionPath: string;
  outputJsonPath: string;
  imagePaths: string[];
  appendImage(image: GeneratedImageOutput, index: number): Promise<string>;
  finalize(generated: ImageExecutionModelResult): Promise<SavedImageTaskArtifacts>;
}

export function createFileImageTaskArtifactStore(workspaceDir: string): ImageTaskArtifactStore {
  return {
    async begin(input) {
      return beginImageTaskArtifacts(workspaceDir, input);
    },
    async save(input) {
      const session = await beginImageTaskArtifacts(workspaceDir, input);
      for (const [index, image] of input.generated.images.entries()) {
        await session.appendImage(image, index);
      }
      return session.finalize(input.generated);
    },
  };
}

function resolveImageTaskOutputDir(
  workspaceDir: string,
  task: SaveImageTaskArtifactsInput['task'],
) {
  const dateSegment = formatDate(task.createdAt);
  const batchId = task.request.outputBatchId?.trim();
  if (batchId) {
    return path.join(
      workspaceDir,
      'outputs',
      dateSegment,
      `batch-${sanitizePathSegment(batchId)}`,
    );
  }

  return path.join(
    workspaceDir,
    'outputs',
    dateSegment,
    sanitizePathSegment(task.taskId),
  );
}

function resolveArtifactFilePrefix(task: SaveImageTaskArtifactsInput['task']) {
  return task.request.outputBatchId?.trim()
    ? `${sanitizePathSegment(task.taskId)}-`
    : '';
}

async function beginImageTaskArtifacts(
  workspaceDir: string,
  input: Omit<SaveImageTaskArtifactsInput, 'generated'>,
): Promise<ImageTaskArtifactSession> {
  const outputDir = resolveImageTaskOutputDir(workspaceDir, input.task);
  await mkdir(outputDir, { recursive: true });

  const filePrefix = resolveArtifactFilePrefix(input.task);
  const requestJsonPath = path.join(outputDir, `${filePrefix}request.json`);
  const imageInstructionPath = path.join(outputDir, `${filePrefix}image-instruction.txt`);
  const outputJsonPath = path.join(outputDir, `${filePrefix}result-1.json`);
  const imagePaths: string[] = [];

  await writeFile(requestJsonPath, JSON.stringify(createRequestSummary(input), null, 2), 'utf-8');
  await writeFile(imageInstructionPath, input.finalPrompt, 'utf-8');

  return {
    outputDir,
    requestJsonPath,
    imageInstructionPath,
    outputJsonPath,
    imagePaths,
    async appendImage(image, index) {
      const imagePath = path.join(
        outputDir,
        `${filePrefix}result-${index + 1}${extensionForImage(image.fileName, image.mimeType)}`,
      );
      await writeFile(imagePath, Buffer.from(image.buffer));
      imagePaths.push(imagePath);
      return imagePath;
    },
    async finalize(generated) {
      await writeFile(outputJsonPath, JSON.stringify(createOutputSummary(input, imagePaths, generated), null, 2), 'utf-8');
      return {
        outputDir,
        images: imagePaths,
        requestJsonPath,
        imageInstructionPath,
        outputJsonPath,
      };
    },
  };
}

function createRequestSummary(input: Omit<SaveImageTaskArtifactsInput, 'generated'>) {
  return {
    taskId: input.task.taskId,
    feature: input.task.feature,
    request: input.task.request,
    plan: {
      mainPrompt: input.plan.mainPrompt,
      executionStage: input.plan.executionStage,
      outputAspectRatio: input.plan.outputAspectRatio,
      outputSpec: input.plan.outputSpec,
      openaiImageSize: input.plan.openaiImageSize,
      resolvedVariationStrategy: input.plan.resolvedVariationStrategy,
      count: input.plan.count,
      executionImages: input.plan.executionImages.map((image) => ({
        role: image.role,
        path: image.path,
        mimeType: image.mimeType,
        label: image.label,
      })),
    },
  };
}

function createOutputSummary(
  input: Omit<SaveImageTaskArtifactsInput, 'generated'>,
  imagePaths: string[],
  generated: ImageExecutionModelResult,
) {
  return {
    taskId: input.task.taskId,
    feature: input.task.feature,
    model: input.plan.executionStage.model,
    protocol: input.plan.executionStage.protocol,
    finalPrompt: input.finalPrompt,
    outputs: generated.images.map((image, index) => ({
      path: imagePaths[index],
      mimeType: image.mimeType,
      bytes: image.buffer.byteLength,
      width: image.width,
      height: image.height,
    })),
    textNotes: generated.textNotes ?? [],
    warnings: generated.warnings ?? [],
  };
}

function formatDate(isoDate: string) {
  return isoDate.slice(0, 10).replaceAll('-', '');
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function extensionForImage(fileName: string, mimeType: string) {
  const parsed = path.parse(fileName);
  if (parsed.ext) return parsed.ext;
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/webp') return '.webp';
  return '.png';
}

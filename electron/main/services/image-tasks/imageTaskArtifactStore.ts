import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ImageTaskArtifactStore,
  SaveImageTaskArtifactsInput,
  SavedImageTaskArtifacts,
} from './imageTaskExecutor.js';

export function createFileImageTaskArtifactStore(workspaceDir: string): ImageTaskArtifactStore {
  return {
    async save(input) {
      return saveImageTaskArtifacts(workspaceDir, input);
    },
  };
}

async function saveImageTaskArtifacts(
  workspaceDir: string,
  input: SaveImageTaskArtifactsInput,
): Promise<SavedImageTaskArtifacts> {
  const outputDir = path.join(
    workspaceDir,
    'outputs',
    formatDate(input.task.createdAt),
    sanitizePathSegment(input.task.taskId),
  );
  await mkdir(outputDir, { recursive: true });

  const requestJsonPath = path.join(outputDir, 'request.json');
  const imageInstructionPath = path.join(outputDir, 'image-instruction.txt');
  const outputJsonPath = path.join(outputDir, 'result-1.json');
  const imagePaths: string[] = [];

  await writeFile(requestJsonPath, JSON.stringify(createRequestSummary(input), null, 2), 'utf-8');
  await writeFile(imageInstructionPath, input.finalPrompt, 'utf-8');

  for (const [index, image] of input.generated.images.entries()) {
    const imagePath = path.join(outputDir, `result-${index + 1}${extensionForImage(image.fileName, image.mimeType)}`);
    await writeFile(imagePath, Buffer.from(image.buffer));
    imagePaths.push(imagePath);
  }

  await writeFile(outputJsonPath, JSON.stringify(createOutputSummary(input, imagePaths), null, 2), 'utf-8');

  return {
    outputDir,
    images: imagePaths,
    requestJsonPath,
    imageInstructionPath,
    outputJsonPath,
  };
}

function createRequestSummary(input: SaveImageTaskArtifactsInput) {
  return {
    taskId: input.task.taskId,
    feature: input.task.feature,
    request: input.task.request,
    plan: {
      mainPrompt: input.plan.mainPrompt,
      instructionSystemPrompt: input.plan.instructionSystemPrompt,
      instructionStage: input.plan.instructionStage,
      executionStage: input.plan.executionStage,
      outputAspectRatio: input.plan.outputAspectRatio,
      openaiImageSize: input.plan.openaiImageSize,
      count: input.plan.count,
      instructionImages: input.plan.instructionImages.map((image) => ({
        role: image.role,
        path: image.path,
        mimeType: image.mimeType,
        label: image.label,
      })),
      executionImages: input.plan.executionImages.map((image) => ({
        role: image.role,
        path: image.path,
        mimeType: image.mimeType,
        label: image.label,
      })),
    },
  };
}

function createOutputSummary(input: SaveImageTaskArtifactsInput, imagePaths: string[]) {
  return {
    taskId: input.task.taskId,
    feature: input.task.feature,
    model: input.plan.executionStage.model,
    protocol: input.plan.executionStage.protocol,
    finalPrompt: input.finalPrompt,
    outputs: input.generated.images.map((image, index) => ({
      path: imagePaths[index],
      mimeType: image.mimeType,
      bytes: image.buffer.byteLength,
    })),
    textNotes: input.generated.textNotes ?? [],
    warnings: input.generated.warnings ?? [],
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

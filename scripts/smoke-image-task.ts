import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ImageInput, ImageTaskRecord, ImageTaskRequest } from '../src/shared/domain/imageFeatureApi.js';
import type { ImageModelProtocol } from '../src/shared/domain/imageFeatureApi.js';
import type { AppSettings } from '../src/shared/domain/settings.js';
import { createDefaultAppSettings } from '../src/shared/domain/settings.js';
import { createImageTaskController } from '../electron/main/services/image-tasks/imageTaskController.js';
import { validateImageTaskRequestForMain } from '../electron/main/services/image-tasks/requestSecurity.js';
import { createSettingsBackedImageTaskExecutor } from '../electron/main/services/image-tasks/settingsBackedImageTaskExecutor.js';
import { createFileSettingsStore } from '../electron/main/services/settings/settingsStore.js';

interface CliOptions {
  requestPath: string;
  runDir?: string;
  workspaceDir?: string;
}

const DEFAULT_RUNS_DIR = 'artifacts/smoke-runs';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runDir = resolveRunDir(options.runDir);
  const storageBase = path.join(runDir, 'storage');
  const importsDir = path.join(storageBase, 'imports');
  const outputsDir = path.join(storageBase, 'outputs');
  const settingsFile = path.join(storageBase, 'settings', 'settings.json');
  const requestPath = path.resolve(options.requestPath);
  const workspaceDir = path.resolve(options.workspaceDir ?? path.join(runDir, 'workspace'));

  await mkdir(importsDir, { recursive: true });
  await mkdir(outputsDir, { recursive: true });
  await mkdir(path.dirname(settingsFile), { recursive: true });
  await mkdir(workspaceDir, { recursive: true });

  const rawRequest = JSON.parse(await readFile(requestPath, 'utf-8')) as ImageTaskRequest;
  const request = await rewriteRequestImagesIntoAuthorizedImports(rawRequest, importsDir);

  const settingsStore = createFileSettingsStore(settingsFile, workspaceDir);
  await settingsStore.save(buildSettings(workspaceDir));

  await validateImageTaskRequestForMain({
    request,
    authorizedRoots: [importsDir, outputsDir, storageBase],
  });

  const executor = createSettingsBackedImageTaskExecutor(settingsStore);
  const controller = createImageTaskController({
    maxConcurrency: 1,
    execute: executor,
  });

  const completed = await new Promise<ImageTaskRecord>((resolve, reject) => {
    const off = controller.onStatus((task) => {
      console.log(`[${task.status}] ${task.taskId}`);
      if (task.status === 'completed') {
        off();
        resolve(task);
      } else if (task.status === 'failed' || task.status === 'canceled') {
        off();
        reject(new Error(task.error?.message ?? `task ${task.status}`));
      }
    });

    const submitted = controller.submit(request);
    console.log(`submitted: ${submitted.taskId}`);
  });

  const summaryPath = path.join(runDir, 'task-result.json');
  await writeFile(summaryPath, `${JSON.stringify(completed, null, 2)}\n`, 'utf-8');

  console.log(`run dir: ${runDir}`);
  console.log(`workspace dir: ${workspaceDir}`);
  console.log(`request summary: ${completed.requestJsonPath}`);
  console.log(`instruction: ${completed.imageInstructionPath}`);
  console.log(`result json: ${completed.outputJsonPath}`);
  console.log(`images: ${completed.images.join(', ')}`);
  console.log(`task result: ${summaryPath}`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    requestPath: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--request') {
      options.requestPath = readRequiredValue(argv, ++index, '--request');
    } else if (arg === '--run-dir') {
      options.runDir = readRequiredValue(argv, ++index, '--run-dir');
    } else if (arg === '--workspace') {
      options.workspaceDir = readRequiredValue(argv, ++index, '--workspace');
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (!options.requestPath) {
    throw new Error('--request is required');
  }

  return options;
}

function readRequiredValue(argv: string[], index: number, flagName: string) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`missing value for ${flagName}`);
  }
  return value;
}

function printUsage() {
  console.log(`AI image task real-scene smoke runner

Usage:
  node --env-file=.env --import tsx scripts/smoke-image-task.ts --request <path> [options]

Options:
  --request <path>     Path to an ImageTaskRequest JSON file
  --run-dir <path>     Optional run sandbox directory
  --workspace <path>   Optional output workspace directory
  --help               Show this message

Environment:
  N1N_API_KEY or LLM_API_KEY or OPENAI_API_KEY
  N1N_BASE_URL or LLM_BASE_URL or OPENAI_BASE_URL
  VISION_MODEL / IMAGE_MODEL / GENERATION_MODEL / EDIT_MODEL (optional)
  MODEL_PROTOCOL=openai|gemini (optional, maps env models missing from defaults)
`);
}

function resolveRunDir(explicitRunDir?: string) {
  if (explicitRunDir) {
    return path.resolve(explicitRunDir);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.resolve(DEFAULT_RUNS_DIR, timestamp);
}

function buildSettings(workspaceDir: string): AppSettings {
  const settings = createDefaultAppSettings(workspaceDir);
  const apiKey = process.env.N1N_API_KEY
    ?? process.env.LLM_API_KEY
    ?? process.env.OPENAI_API_KEY
    ?? '';
  const baseUrl = process.env.N1N_BASE_URL
    ?? process.env.LLM_BASE_URL
    ?? process.env.OPENAI_BASE_URL
    ?? settings.baseUrl;
  const imageModel = process.env.IMAGE_MODEL?.trim();
  // TODO: restore vision/edit model fields when type is expanded
  // const visionModel = process.env.VISION_MODEL?.trim() ?? settings.defaultModels.vision;
  const generationModel = process.env.GENERATION_MODEL?.trim()
    ?? imageModel
    ?? settings.defaultModels.generation;
  // const editModel = process.env.EDIT_MODEL?.trim()
  //   ?? imageModel
  //   ?? settings.defaultModels.edit;

  return {
    ...settings,
    n1nApiKey: apiKey,
    baseUrl,
    defaultModels: {
      generation: generationModel,
    },
    modelProtocols: applyEnvModelProtocols(settings.modelProtocols, {
      generation: generationModel,
    }),
  };
}

function applyEnvModelProtocols(
  defaults: Record<string, ImageModelProtocol>,
  models: { generation: string },
): Record<string, ImageModelProtocol> {
  const protocol = process.env.MODEL_PROTOCOL?.trim();
  if (protocol !== 'openai' && protocol !== 'gemini') {
    return defaults;
  }

  const next = { ...defaults };
  for (const model of Object.values(models)) {
    if (!next[model]) {
      next[model] = protocol;
    }
  }

  return next;
}

async function rewriteRequestImagesIntoAuthorizedImports(
  request: ImageTaskRequest,
  importsDir: string,
): Promise<ImageTaskRequest> {
  const images = await Promise.all((request.images ?? []).map(async (image, index) => ({
    ...image,
    path: await copyImageIntoAuthorizedImports(image, importsDir, index),
  })));

  return {
    ...request,
    images,
  };
}

async function copyImageIntoAuthorizedImports(image: ImageInput, importsDir: string, index: number) {
  const sourcePath = path.resolve(image.path);
  const parsed = path.parse(sourcePath);
  const fileName = `${String(index + 1).padStart(2, '0')}-${sanitizeSegment(image.role)}${parsed.ext || '.png'}`;
  const targetPath = path.join(importsDir, fileName);
  await copyFile(sourcePath, targetPath);
  return targetPath;
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

main().catch((error: unknown) => {
  console.error(`image task smoke failed: ${formatError(error)}`);
  process.exit(1);
});

function formatError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const messages = [error.message];
  let current: unknown = error.cause;
  while (current instanceof Error) {
    messages.push(current.message);
    current = current.cause;
  }

  return messages.join(' <- ');
}

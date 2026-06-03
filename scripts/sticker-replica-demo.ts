import OpenAI from "openai";
import * as fs from "node:fs";
import * as path from "node:path";

import { buildImageEditPrompt } from "./lib/image-workflow/image-edit-prompt";
import { readImageAsDataUrl, readPngDimensions } from "./lib/image-workflow/image-io";
import {
  buildFinalPromptUserMessage,
  editStickerImage,
  generateFinalPrompt,
} from "./lib/image-workflow/openai-workflow";
import { resolveOpenAIBaseURL } from "./lib/model-clients/openai-config";
import {
  buildFinalPromptInstructions,
  loadPromptTemplates,
} from "./lib/image-workflow/prompt-templates";
import type { CliOptions, OutputPaths } from "./lib/shared/image-workflow-types";

export {
  buildImageEditPrompt,
  buildFinalPromptUserMessage,
  buildFinalPromptInstructions,
  loadPromptTemplates,
};

const REPO_ROOT = process.cwd();
const DEFAULT_INPUT_PATH = "tests/fixtures/images/image.png";
const DEFAULT_OUTPUT_DIR = "artifacts/output";
const DEFAULT_VISION_MODEL = process.env.VISION_MODEL ?? "gpt-5.4-mini";
const DEFAULT_IMAGE_MODEL = process.env.IMAGE_MODEL ?? "gpt-image-2";
const DEFAULT_IMAGE_SIZE = process.env.IMAGE_SIZE ?? "1536x1024";
const DEFAULT_STICKER_REPLICATION_PROMPT = "提取当前产品上面的贴纸";

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    imageModel: DEFAULT_IMAGE_MODEL,
    imageSize: DEFAULT_IMAGE_SIZE,
    inputPath: DEFAULT_INPUT_PATH,
    userPrompt: buildStickerReplicationUserPrompt(),
    visionModel: DEFAULT_VISION_MODEL,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--input") {
      options.inputPath = readRequiredValue(argv, ++index, "--input");
    } else if (arg === "--output") {
      options.outputPath = readRequiredValue(argv, ++index, "--output");
    } else if (arg === "--prompt") {
      options.userPrompt = buildStickerReplicationUserPrompt(readRequiredValue(argv, ++index, "--prompt"));
    } else if (arg === "--vision-model") {
      options.visionModel = readRequiredValue(argv, ++index, "--vision-model");
    } else if (arg === "--image-model") {
      options.imageModel = readRequiredValue(argv, ++index, "--image-model");
    } else if (arg === "--size") {
      options.imageSize = readRequiredValue(argv, ++index, "--size");
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`未知参数: ${arg}`);
    }
  }

  return options;
}

function readRequiredValue(argv: string[], index: number, flagName: string): string {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`缺少 ${flagName} 的参数值`);
  }
  return value;
}

function printUsage(): void {
  console.log(`贴纸复刻两阶段演示

用法:
  node --env-file=.env --import tsx scripts/sticker-replica-demo.ts [选项]

选项:
  --input <path>          参考贴纸或包装图路径
  --output <path>         输出 PNG 路径，默认为 artifacts/output/<timestamp>-sticker-replication.png
  --prompt <text>         附加贴纸复刻说明，会拼接在默认“${DEFAULT_STICKER_REPLICATION_PROMPT}”之后
  --vision-model <name>   视觉/文本模型，默认为 ${DEFAULT_VISION_MODEL}
  --image-model <name>    图像模型，默认为 ${DEFAULT_IMAGE_MODEL}
  --size <WxH>            输出尺寸，默认为 ${DEFAULT_IMAGE_SIZE}
  --help                  显示此帮助信息`);
}

export function buildStickerReplicationUserPrompt(additionalPrompt?: string): string {
  const trimmedAdditionalPrompt = additionalPrompt?.trim();
  if (!trimmedAdditionalPrompt) {
    return DEFAULT_STICKER_REPLICATION_PROMPT;
  }

  return `${DEFAULT_STICKER_REPLICATION_PROMPT}。附加要求：${trimmedAdditionalPrompt}`;
}

function ensureApiKey(): string {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("环境变量中缺少 LLM_API_KEY");
  }
  return apiKey;
}

function ensureModelProtocol(): void {
  const protocol = process.env.MODEL_PROTOCOL;
  if (protocol && protocol !== "openai") {
    throw new Error(`此脚本要求 MODEL_PROTOCOL 为 openai，当前为: ${protocol}`);
  }
}

function resolveOutputPath(explicitOutputPath?: string): string {
  if (explicitOutputPath) {
    return path.resolve(explicitOutputPath);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve(DEFAULT_OUTPUT_DIR, `${timestamp}-sticker-replication.png`);
}

export function resolveStickerReplicationOutputPaths(outputPath: string): OutputPaths {
  const parsed = path.parse(outputPath);
  return {
    imagePath: outputPath,
    imageInstructionPath: path.join(parsed.dir, `${parsed.name}-image-instruction.txt`),
    jsonPath: path.join(parsed.dir, `${parsed.name}.json`),
  };
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  ensureModelProtocol();
  const apiKey = ensureApiKey();

  const outputPath = resolveOutputPath(options.outputPath);
  const outputPaths = resolveStickerReplicationOutputPaths(outputPath);
  const inputPath = path.resolve(options.inputPath);

  fs.mkdirSync(path.dirname(outputPaths.imagePath), { recursive: true });

  const client = new OpenAI({
    apiKey,
    baseURL: resolveOpenAIBaseURL(),
  });

  console.log(`视觉模型: ${options.visionModel}`);
  console.log(`图像模型: ${options.imageModel}`);
  console.log(`请求图像尺寸: ${options.imageSize}`);
  console.log(`输入: ${inputPath}`);
  console.log(`输出图片: ${outputPaths.imagePath}`);
  console.log(`图片执行指令: ${outputPaths.imageInstructionPath}`);
  console.log(`输出 JSON: ${outputPaths.jsonPath}`);

  console.log("正在生成图片执行指令...");
  const templates = loadPromptTemplates();
  const finalPrompt = await generateFinalPrompt(
    client,
    options,
    readImageAsDataUrl(inputPath),
    templates,
  );
  const imageEditPrompt = buildImageEditPrompt(finalPrompt);

  console.log("正在将参考图编辑为独立贴纸...");
  const editResult = await editStickerImage(
    client,
    inputPath,
    options.imageModel,
    options.imageSize,
    imageEditPrompt,
  );
  const actualOutputSize = readPngDimensions(editResult.imageBuffer);

  fs.writeFileSync(outputPaths.imagePath, editResult.imageBuffer);
  fs.writeFileSync(outputPaths.imageInstructionPath, `${imageEditPrompt}\n`, "utf8");
  writeJson(outputPaths.jsonPath, {
    feature: "sticker-replication",
    status: "completed",
    executionMode: "image-edit",
    inputPath,
    outputImagePath: outputPaths.imagePath,
    imageInstructionPath: outputPaths.imageInstructionPath,
    models: {
      vision: options.visionModel,
      edit: options.imageModel,
    },
    requestedImageSize: options.imageSize,
    actualOutputSize,
    userPrompt: options.userPrompt,
    finalPrompt: imageEditPrompt,
    imageResponse: editResult.sanitizedResponse,
  });

  console.log(`实际输出尺寸: ${actualOutputSize ? `${actualOutputSize.width}x${actualOutputSize.height}` : "unknown"}`);
  console.log(`已保存图片执行指令: ${outputPaths.imageInstructionPath}`);
  console.log(`已保存图像: ${outputPaths.imagePath}`);
  console.log(`已保存 JSON: ${outputPaths.jsonPath}`);
}

const isEntryPoint =
  typeof process.argv[1] === "string" &&
  path.resolve(process.argv[1]) === path.resolve(REPO_ROOT, "scripts/sticker-replica-demo.ts");

if (isEntryPoint) {
  runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`贴纸复刻演示失败: ${message}`);
    process.exit(1);
  });
}

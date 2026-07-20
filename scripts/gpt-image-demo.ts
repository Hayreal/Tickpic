import OpenAI from "openai";
import * as fs from "node:fs";
import * as path from "node:path";

import { readPngDimensions } from "./lib/image-workflow/image-io";
import { resolveOpenAIBaseURL } from "./lib/model-clients/openai-config";

type ImageResponseItem = {
  b64_json?: string;
  base64?: string;
  image_base64?: string;
  url?: string;
  [key: string]: unknown;
};

type CliOptions = {
  inputPath: string;
  model: string;
  outputPath?: string;
  prompt: string;
  quality: "auto" | "low" | "medium" | "high";
  size: string;
};

const DEFAULT_INPUT_PATH = "tests/fixtures/images/image.png";
const DEFAULT_OUTPUT_DIR = "artifacts/output";
const DEFAULT_MODEL = process.env.IMAGE_MODEL ?? "gpt-image-2";
const DEFAULT_PROMPT = "提取图中的贴纸";
const DEFAULT_QUALITY = "auto";
const DEFAULT_SIZE = process.env.IMAGE_SIZE ?? "728x512";

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    inputPath: DEFAULT_INPUT_PATH,
    model: DEFAULT_MODEL,
    prompt: DEFAULT_PROMPT,
    quality: DEFAULT_QUALITY,
    size: DEFAULT_SIZE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--input") {
      options.inputPath = readRequiredValue(argv, ++index, "--input");
    } else if (arg === "--output") {
      options.outputPath = readRequiredValue(argv, ++index, "--output");
    } else if (arg === "--model") {
      options.model = readRequiredValue(argv, ++index, "--model");
    } else if (arg === "--prompt") {
      options.prompt = readRequiredValue(argv, ++index, "--prompt");
    } else if (arg === "--quality") {
      options.quality = parseQuality(readRequiredValue(argv, ++index, "--quality"));
    } else if (arg === "--size") {
      options.size = readRequiredValue(argv, ++index, "--size");
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

function parseQuality(value: string): CliOptions["quality"] {
  if (value === "auto" || value === "low" || value === "medium" || value === "high") {
    return value;
  }
  throw new Error(`不支持的 quality: ${value}`);
}

function printUsage(): void {
  console.log(`GPT Image 尺寸验证

用法:
  node --env-file=.env --import tsx scripts/gpt-image-demo.ts [选项]

选项:
  --input <path>        输入图片路径，默认 ${DEFAULT_INPUT_PATH}
  --output <path>       输出 PNG 路径，默认 artifacts/output/<timestamp>-gpt-image-size.png
  --model <name>        图片模型，默认 ${DEFAULT_MODEL}
  --prompt <text>       编辑提示词，默认 "${DEFAULT_PROMPT}"
  --size <WxH>          请求输出尺寸，默认 ${DEFAULT_SIZE}
  --quality <value>     auto | low | medium | high，默认 ${DEFAULT_QUALITY}
  --help                显示此帮助信息`);
}

function ensureApiKey(): string {
  const apiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("环境变量中缺少 LLM_API_KEY 或 OPENAI_API_KEY");
  }
  return apiKey;
}

function resolveOutputPath(explicitOutputPath?: string): string {
  if (explicitOutputPath) {
    return path.resolve(explicitOutputPath);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve(DEFAULT_OUTPUT_DIR, `${timestamp}-gpt-image-size.png`);
}

function warnIfLikelyInvalidSizeForGptImage2(size: string): void {
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) {
    console.warn(`尺寸不是 WIDTHxHEIGHT 格式，服务可能拒绝或忽略: ${size}`);
    return;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width % 16 !== 0 || height % 16 !== 0) {
    console.warn(`注意: gpt-image-2 通常要求宽高都能被 16 整除；当前请求为 ${size}`);
  }
}

async function extractImageBuffer(response: OpenAI.Images.ImagesResponse): Promise<Buffer> {
  const firstImage = response.data?.[0] as ImageResponseItem | undefined;
  const imageBase64 = firstImage?.b64_json ?? firstImage?.base64 ?? firstImage?.image_base64;
  if (imageBase64) {
    return Buffer.from(imageBase64, "base64");
  }

  if (firstImage?.url) {
    return downloadImage(firstImage.url);
  }

  throw new Error(
    `图像模型未返回可用图像；data[0] 字段: ${
      firstImage ? Object.keys(firstImage).join(", ") || "(empty)" : "(missing)"
    }`,
  );
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`图像 URL 下载失败: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function sanitizeImageResponse(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeImageResponse);
  }

  if (value && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
      if (typeof entryValue === "string" && isLikelyBase64ImageField(key)) {
        sanitized[key] = `[base64 omitted, length=${entryValue.length}]`;
      } else {
        sanitized[key] = sanitizeImageResponse(entryValue);
      }
    }
    return sanitized;
  }

  return value;
}

function isLikelyBase64ImageField(key: string): boolean {
  return key === "b64_json" || key === "base64" || key === "image_base64";
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(options.inputPath);
  const outputPath = resolveOutputPath(options.outputPath);
  const responsePath = outputPath.replace(/\.png$/i, ".response.json");

  if (!fs.existsSync(inputPath)) {
    throw new Error(`找不到输入图片: ${inputPath}`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  warnIfLikelyInvalidSizeForGptImage2(options.size);

  const client = new OpenAI({
    apiKey: ensureApiKey(),
    baseURL: resolveOpenAIBaseURL(),
  });

  console.log(`模型: ${options.model}`);
  console.log(`请求尺寸: ${options.size}`);
  console.log(`输入: ${inputPath}`);
  console.log(`输出: ${outputPath}`);

  const response = await client.images.edit({
    image: fs.createReadStream(inputPath),
    model: options.model,
    prompt: options.prompt,
    size: options.size,
    quality: options.quality,
  });

  fs.writeFileSync(responsePath, `${JSON.stringify(sanitizeImageResponse(response), null, 2)}\n`, "utf8");

  const imageBuffer = await extractImageBuffer(response);
  fs.writeFileSync(outputPath, imageBuffer);

  const actualSize = readPngDimensions(imageBuffer);
  console.log(`响应 size 字段: ${response.size ?? "(none)"}`);
  console.log(`实际 PNG 尺寸: ${actualSize ? `${actualSize.width}x${actualSize.height}` : "unknown"}`);
  console.log(`响应记录: ${responsePath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`GPT Image 尺寸验证失败: ${message}`);
  process.exit(1);
});

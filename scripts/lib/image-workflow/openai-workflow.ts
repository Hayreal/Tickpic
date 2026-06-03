import OpenAI from "openai";
import * as fs from "node:fs";

import type { CliOptions, PromptTemplates } from "../shared/image-workflow-types";
import { buildFinalPromptInstructions } from "./prompt-templates";

type ImageResponseItem = {
  b64_json?: string;
  base64?: string;
  image_base64?: string;
  url?: string;
  [key: string]: unknown;
};

export type ImageEditResult = {
  imageBuffer: Buffer;
  sanitizedResponse: unknown;
};

export async function generateFinalPrompt(
  client: OpenAI,
  options: CliOptions,
  imageDataUrl: string,
  templates: PromptTemplates,
): Promise<string> {
  const response = await client.responses.create({
    model: options.visionModel,
    instructions: buildFinalPromptInstructions(templates, options.userPrompt),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildFinalPromptUserMessage(options.userPrompt),
          },
          {
            type: "input_image",
            image_url: imageDataUrl,
            detail: "auto",
          },
        ],
      },
    ],
    text: {
      verbosity: "low",
    },
  });

  const finalPrompt = response.output_text.trim();
  if (!finalPrompt) {
    throw new Error("图片执行指令生成模型未返回 finalPrompt");
  }

  return finalPrompt;
}

export function buildFinalPromptUserMessage(userPrompt: string): string {
  return [
    "Generate a concise image edit instruction for the Sticker Replication image edit stage.",
    "If the user's wording is vague, infer the intended replacement targets from the visible sticker or label, such as brand, main title, product name, count, capacity, or net weight.",
    "If the user gives one brand-like word without saying title, name, product name, or main title, treat it as a brand replacement only and preserve the source sticker's main title.",
    "Preserve explicit replacement words, numbers, units, brand names, punctuation, and casing exactly.",
    "For explicit text replacements, phrase the image edit instruction so the image edit model must render the provided text exactly as written.",
    "Use the uploaded image only to understand which visible sticker or label should be extracted.",
    "Do not return image analysis, layout plans, negative prompt lists, JSON, Markdown, labels, or commentary.",
    "Do not add specific visual details that the user did not request.",
    "Return only the image edit instruction text.",
    "Prefer 1-3 sentences.",
    "",
    "User prompt:",
    userPrompt,
  ].join("\n");
}

export async function editStickerImage(
  client: OpenAI,
  inputPath: string,
  imageModel: string,
  imageSize: string,
  imageEditPrompt: string,
): Promise<ImageEditResult> {
  const response = await client.images.edit({
    image: fs.createReadStream(inputPath),
    model: imageModel,
    prompt: imageEditPrompt,
    size: imageSize,
    quality: "auto",
    background: "opaque",
    output_format: "png",
    input_fidelity: "high",
  });

  const sanitizedResponse = sanitizeImageResponse(response);

  const firstImage = response.data?.[0] as ImageResponseItem | undefined;
  const imageBase64 = firstImage?.b64_json ?? firstImage?.base64 ?? firstImage?.image_base64;
  if (imageBase64) {
    return {
      imageBuffer: Buffer.from(imageBase64, "base64"),
      sanitizedResponse,
    };
  }

  if (firstImage?.url) {
    return {
      imageBuffer: await downloadImage(firstImage.url),
      sanitizedResponse,
    };
  }

  throw new Error(
    [
      "图像模型未返回可用图像",
      `data[0] 字段: ${firstImage ? Object.keys(firstImage).join(", ") || "(empty)" : "(missing)"}`,
    ].join("；"),
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

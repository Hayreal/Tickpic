import OpenAI from "openai";
import * as fs from "node:fs";

import { PROMPT_ENHANCEMENT_SCHEMA } from "../shared/prompt-enhancement-schema";
import type { CliOptions, PromptEnhancement, PromptTemplates } from "../shared/image-workflow-types";
import { buildPromptEnhancementInstructions } from "./prompt-templates";

type ImageResponseItem = {
  b64_json?: string;
  base64?: string;
  image_base64?: string;
  url?: string;
  [key: string]: unknown;
};

export async function generatePromptEnhancement(
  client: OpenAI,
  options: CliOptions,
  imageDataUrl: string,
  templates: PromptTemplates,
): Promise<PromptEnhancement> {
  const response = await client.responses.create({
    model: options.visionModel,
    instructions: buildPromptEnhancementInstructions(templates, options.userPrompt),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Generate the structured JSON control description for the Sticker Replication feature.",
              "The output will be consumed by a downstream image-edit model.",
              "Set feature to sticker-replication.",
              "Use a horizontal sticker composition if the reference sticker is horizontal.",
              "Write finalPrompt as a conservative edit instruction: unwrap and flatten the original label, preserve exact visible text, relative layout, font scale, honeycomb area scale, and accent placement.",
              "Do not use phrases that imply creative redesign, such as inspired by, redesigned, upgraded, premium version, or enhanced.",
            ].join("\n"),
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
      format: {
        type: "json_schema",
        name: "sticker_replication_control_description",
        strict: true,
        schema: PROMPT_ENHANCEMENT_SCHEMA,
      },
      verbosity: "low",
    },
  });

  const parsed = JSON.parse(response.output_text) as PromptEnhancement;
  if (!parsed.finalPrompt?.trim()) {
    throw new Error("提示词增强 JSON 中未包含 finalPrompt");
  }

  return parsed;
}

export async function editStickerImage(
  client: OpenAI,
  inputPath: string,
  imageModel: string,
  imageSize: string,
  imageEditPrompt: string,
  imageResponsePath: string,
): Promise<Buffer> {
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

  fs.writeFileSync(imageResponsePath, `${JSON.stringify(sanitizeImageResponse(response), null, 2)}\n`, "utf8");

  const firstImage = response.data?.[0] as ImageResponseItem | undefined;
  const imageBase64 = firstImage?.b64_json ?? firstImage?.base64 ?? firstImage?.image_base64;
  if (imageBase64) {
    return Buffer.from(imageBase64, "base64");
  }

  if (firstImage?.url) {
    return downloadImage(firstImage.url);
  }

  throw new Error(
    [
      "图像模型未返回可用图像",
      `原始响应已保存: ${imageResponsePath}`,
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

import * as fs from "node:fs";
import * as path from "node:path";

import type { PromptTemplates } from "../shared/image-workflow-types";

const PROMPTS_DOC_PATH = path.resolve(process.cwd(), "docs/ai-image-system-prompts.md");

export function loadPromptTemplates(markdownPath = PROMPTS_DOC_PATH): PromptTemplates {
  const markdown = fs.readFileSync(markdownPath, "utf8");

  return {
    generalSystemPrompt: extractCodeBlock(markdown, "## 通用系统提示词"),
    finalPromptSystemPrompt: extractCodeBlock(markdown, "## 图片执行指令生成系统提示词"),
    stickerReplicationPrompt: extractCodeBlock(markdown, "## 1. 贴纸复刻"),
  };
}

function extractCodeBlock(markdown: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`${escapedHeading}[\\s\\S]*?\`\`\`text\\n([\\s\\S]*?)\\n\`\`\``, "m");
  const match = markdown.match(regex);

  if (!match?.[1]) {
    throw new Error(`Unable to extract prompt section for heading: ${heading}`);
  }

  return match[1].trim();
}

export function buildFinalPromptInstructions(
  templates: PromptTemplates,
  userPrompt: string,
): string {
  return [
    templates.finalPromptSystemPrompt,
    "You are generating a concise image edit instruction for an e-commerce sticker image edit workflow.",
    templates.stickerReplicationPrompt,
    "Output the image edit instruction text only.",
    "Do not output JSON, Markdown, analysis, labels, or extra commentary.",
    "Build the image edit instruction from the structured task parameters and the user's prompt.",
    "Keep the image edit instruction close to the user's wording and language.",
    "If the user's wording is vague, infer the intended sticker text fields from the uploaded label context, such as brand, main title, product name, count, capacity, or net weight.",
    "If the user gives one brand-like word without saying title, name, product name, or main title, treat it as a brand replacement only and preserve the source sticker's main title.",
    "Preserve any explicit replacement words, numbers, units, brand names, and casing exactly.",
    "For explicit text replacements, phrase the image edit instruction so the image edit model must render the provided text exactly as written.",
    "Use the uploaded image only as visual context for the sticker or label target.",
    "Put necessary restrictions directly into the image edit instruction.",
    "Do not return image analysis, intermediate plans, constraints arrays, or structured data.",
    "Do not introduce specific layout, material, pattern, color, or scene details unless the user wrote them or they are necessary for the sticker extraction task.",
    "The image edit instruction should be concise, efficient, and directly usable by the image edit model.",
    "Prefer 1-3 sentences.",
    "User prompt:",
    userPrompt,
  ].join("\n\n");
}

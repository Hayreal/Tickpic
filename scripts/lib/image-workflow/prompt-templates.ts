import * as fs from "node:fs";
import * as path from "node:path";

import type { PromptTemplates } from "../shared/image-workflow-types";

const PROMPTS_DOC_PATH = path.resolve(process.cwd(), "docs/ai-image-system-prompts.md");

export function loadPromptTemplates(markdownPath = PROMPTS_DOC_PATH): PromptTemplates {
  const markdown = fs.readFileSync(markdownPath, "utf8");

  return {
    generalSystemPrompt: extractCodeBlock(markdown, "## 通用系统提示词"),
    jsonSystemPrompt: extractCodeBlock(markdown, "## 图像理解增强 JSON 系统提示词"),
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

export function buildPromptEnhancementInstructions(
  templates: PromptTemplates,
  userPrompt: string,
): string {
  return [
    templates.generalSystemPrompt,
    templates.jsonSystemPrompt,
    templates.stickerReplicationPrompt,
    "Task-specific reinforcement:",
    "Treat this as the first stage of a two-stage image workflow.",
    "Stage 1 must return the structured JSON control description only.",
    "Stage 2 will use the original reference image as an image-edit input.",
    "The reference image may be a packaging packshot. If so, isolate the sticker or label design language and exclude the product container, white product-photography background, shadows, reflections, measurement lines, and dimension annotations from the design target.",
    "The result must target an independent flat sticker design suitable for packaging application.",
    "For Sticker Replication, finalPrompt must describe a conservative replication/edit operation, not a creative redesign. Use preserve, retain, match, and flatten when appropriate.",
    "The downstream image edit model should keep the source sticker's relative typography scale, approximate spacing, decorative element scale, color block proportions, and visual hierarchy.",
    "Do not ask the downstream model to enlarge, beautify, modernize, upgrade, reinterpret, or turn the sticker into a poster-like graphic.",
    "If the source is a curved or perspective label, describe the target as a flattened front-view version of that same label area.",
    "Additional user prompt:",
    userPrompt,
  ].join("\n\n");
}

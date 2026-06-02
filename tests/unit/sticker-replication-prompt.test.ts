import test from "node:test";
import assert from "node:assert/strict";

import {
  buildImageEditPrompt,
  buildPromptEnhancementInstructions,
  loadPromptTemplates,
} from "../../scripts/sticker-replica-demo";

test("loadPromptTemplates extracts sticker replication prompts from docs", () => {
  const templates = loadPromptTemplates();

  assert.match(templates.generalSystemPrompt, /e-commerce visual design and image generation assistant/i);
  assert.match(templates.jsonSystemPrompt, /Output JSON only/i);
  assert.match(templates.stickerReplicationPrompt, /Sticker Replication/i);
});

test("buildPromptEnhancementInstructions targets structured JSON control output", () => {
  const templates = loadPromptTemplates();
  const instructions = buildPromptEnhancementInstructions(
    templates,
    "Keep the original sticker hierarchy and texture style.",
  );

  assert.match(instructions, /Output JSON only/i);
  assert.match(instructions, /finalPrompt/i);
  assert.match(instructions, /Sticker Replication/i);
  assert.doesNotMatch(instructions, /honeycomb/i);
  assert.doesNotMatch(instructions, /beeswax/i);
  assert.doesNotMatch(instructions, /small label/i);
});

test("buildImageEditPrompt uses finalPrompt and negative constraints", () => {
  const prompt = buildImageEditPrompt({
    finalPrompt:
      "Create a standalone flat front-view sticker label with a black background, bold white typography, and honeycomb texture accents.",
    constraints: [
      "Output must be an independent 2D flat sticker design.",
      "Preserve the original commercial layout hierarchy.",
    ],
    negativeConstraints: [
      "Do not generate jars, lids, bottles, or packaging mockups.",
      "Do not include dimension lines or white product photography background.",
    ],
  });

  assert.match(prompt, /unwrapping and flattening/i);
  assert.match(prompt, /Do not redesign/i);
  assert.match(prompt, /original compact proportions/i);
  assert.match(prompt, /standalone flat front-view sticker label/i);
  assert.match(prompt, /Do not generate jars, lids, bottles, or packaging mockups/i);
  assert.match(prompt, /Do not include dimension lines or white product photography background/i);
});

import { describe, expect, it } from "vitest";

import {
  buildImageEditPrompt,
  buildFinalPromptUserMessage,
  buildStickerReplicationUserPrompt,
  buildFinalPromptInstructions,
  loadPromptTemplates,
  resolveStickerReplicationOutputPaths,
} from "../../scripts/sticker-replica-demo";

describe("sticker replication prompt flow", () => {
  it("loads sticker replication prompts from docs", () => {
    const templates = loadPromptTemplates();

    expect(templates.generalSystemPrompt).toMatch(/e-commerce visual design and image generation assistant/i);
    expect(templates.finalPromptSystemPrompt).toMatch(/Output the image instruction text only/i);
    expect(templates.finalPromptSystemPrompt).toMatch(/Do not output JSON/i);
    expect(templates.stickerReplicationPrompt).toMatch(/Sticker Replication/i);
  });

  it("builds final prompt instructions with concise user requirements", () => {
    const templates = loadPromptTemplates();
    const instructions = buildFinalPromptInstructions(
      templates,
      buildStickerReplicationUserPrompt("帮我换成 wkau，数量写 6PIECES"),
    );

    expect(instructions).toMatch(/Output the image edit instruction text only/i);
    expect(instructions).toMatch(/Do not output JSON/i);
    expect(instructions).not.toMatch(/sourceImageUnderstanding/);
    expect(instructions).not.toMatch(/compositionPlan/);
    expect(instructions).not.toMatch(/negativeConstraints/);
    expect(instructions).toMatch(/image edit instruction/i);
    expect(instructions).toMatch(/Prefer 1-3 sentences/i);
    expect(instructions).toMatch(/Sticker Replication/i);
    expect(instructions).toMatch(/structured task parameters/i);
    expect(instructions).toMatch(/If the user's wording is vague/i);
    expect(instructions).toMatch(/treat it as a brand replacement only/i);
    expect(instructions).toMatch(/render the provided text exactly as written/i);
    expect(instructions).toMatch(/提取当前产品上面的贴纸/);
    expect(instructions).toMatch(/wkau/);
    expect(instructions).toMatch(/6PIECES/);
    expect(instructions).not.toMatch(/honeycomb/i);
    expect(instructions).not.toMatch(/beeswax/i);
    expect(instructions).not.toMatch(/small label/i);
  });

  it("resolves image, instruction, and output json paths", () => {
    expect(resolveStickerReplicationOutputPaths("/tmp/out/sticker.png")).toEqual({
      imagePath: "/tmp/out/sticker.png",
      imageInstructionPath: "/tmp/out/sticker-image-instruction.txt",
      jsonPath: "/tmp/out/sticker.json",
    });
  });

  it("asks the vision stage to generate concise image edit instruction text without rewriting intent", () => {
    const message = buildFinalPromptUserMessage(
      "提取当前产品上面的贴纸。附加要求：帮我换成 wkau，数量写 6PIECES",
    );

    expect(message).toMatch(/Generate a concise image edit instruction/i);
    expect(message).toMatch(/If the user's wording is vague/i);
    expect(message).toMatch(/treat it as a brand replacement only/i);
    expect(message).toMatch(/Preserve explicit replacement words/i);
    expect(message).toMatch(/render the provided text exactly as written/i);
    expect(message).toMatch(/Do not return image analysis/i);
    expect(message).toMatch(/Do not return.*JSON/i);
    expect(message).toMatch(/Prefer 1-3 sentences/i);
    expect(message).toMatch(/wkau/);
    expect(message).toMatch(/6PIECES/);
    expect(message).not.toMatch(/honeycomb/i);
    expect(message).not.toMatch(/horizontal sticker composition/i);
    expect(message).not.toMatch(/accent placement/i);
  });

  it("keeps the default sticker extraction prompt and appends user changes", () => {
    expect(buildStickerReplicationUserPrompt()).toBe("提取当前产品上面的贴纸");
    expect(buildStickerReplicationUserPrompt("帮我换成 wkau，数量写 6PIECES")).toBe(
      "提取当前产品上面的贴纸。附加要求：帮我换成 wkau，数量写 6PIECES",
    );
  });

  it.each([
    {
      name: "short brand and count wording",
      userPrompt: "帮我换成 wkau，数量写 6PIECES",
      expectedTerms: ["wkau", "6PIECES"],
    },
    {
      name: "wood polish casual wording",
      userPrompt: "改成 TICKPIC 的木头护理贴纸，写 WOOD POLISH，规格 80G",
      expectedTerms: ["TICKPIC", "WOOD POLISH", "80G"],
    },
    {
      name: "bottle label casual wording",
      userPrompt: "这个瓶子的贴纸帮我做成 LUMO 牌，名字叫 LENS CLEANER，60ML",
      expectedTerms: ["LUMO", "LENS CLEANER", "60ML"],
    },
    {
      name: "layout-preserving vague wording",
      userPrompt: "版式颜色别变，牌子换 NOVA，下面数量改 12PCS",
      expectedTerms: ["NOVA", "12PCS"],
    },
    {
      name: "minimal user wording",
      userPrompt: "换成 HOLA，24片",
      expectedTerms: ["HOLA", "24片"],
      expectedMessageTerms: ["brand replacement only", "preserve the source sticker's main title"],
    },
  ])("keeps scenario prompt terms for $name", ({ userPrompt, expectedTerms, expectedMessageTerms }) => {
    const composedPrompt = buildStickerReplicationUserPrompt(userPrompt);
    const visionMessage = buildFinalPromptUserMessage(composedPrompt);

    expect(composedPrompt).toMatch(/^提取当前产品上面的贴纸。附加要求：/);
    expect(visionMessage).toMatch(/Generate a concise image edit instruction/i);
    expect(visionMessage).toMatch(/Do not return image analysis/i);
    expect(visionMessage).toMatch(/Do not return.*JSON/i);
    expect(visionMessage).toMatch(/Prefer 1-3 sentences/i);

    for (const expectedTerm of expectedTerms) {
      expect(composedPrompt).toContain(expectedTerm);
      expect(visionMessage).toContain(expectedTerm);
    }

    for (const expectedMessageTerm of expectedMessageTerms ?? []) {
      expect(visionMessage).toContain(expectedMessageTerm);
    }

    expect(visionMessage).not.toMatch(/sourceImageUnderstanding/);
    expect(visionMessage).not.toMatch(/compositionPlan/);
    expect(visionMessage).not.toMatch(/negativeConstraints/);
  });

  it("uses the enhanced user prompt as the image edit prompt body", () => {
    const finalPrompt =
      "提取当前产品上面的贴纸，保持原图贴纸的整体风格和版式，把品牌替换成 wkau，把容量替换成 6PIECES。";
    const prompt = buildImageEditPrompt(finalPrompt);

    expect(prompt).toBe(finalPrompt);
    expect(prompt).not.toMatch(/Apply only the requested text or brand changes/i);
    expect(prompt).not.toMatch(/Hard constraints/i);
    expect(prompt).not.toMatch(/Negative constraints/i);
    expect(prompt).not.toMatch(/honeycomb/i);
    expect(prompt).not.toMatch(/red accent/i);
    expect(prompt).not.toMatch(/hexagon/i);
  });
});

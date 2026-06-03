import type { PromptEnhancement } from "../shared/image-workflow-types";

export function buildImageEditPrompt(
  enhancement: Pick<PromptEnhancement, "finalPrompt" | "constraints" | "negativeConstraints">,
): string {
  const promptSections = [[
    "Edit the provided reference image by unwrapping and flattening only the visible front label/sticker area into a standalone 2D label artwork.",
    "Use the source image as the strict reference for visible wording, typography hierarchy, approximate font scale, text line breaks, spacing, color block relationships, decorative motif scale, and commercial sticker style.",
    "Remove only non-label content: jar body, lid, container curvature, shadows, reflections, white packshot background, measurement lines, and dimension annotations.",
    "Do not redesign, beautify, modernize, expand, or reinterpret the label. Do not create a new poster or large-format banner.",
    "Keep the label's original compact proportions: the title block, honeycomb band, red accent blocks, and hexagon motifs should stay close to their source-image relative sizes and positions.",
    "The result should look like the original small jar label flattened into a rectangular front-view sticker, not a newly designed label.",
    enhancement.finalPrompt.trim(),
  ].join(" ")];

  if (enhancement.constraints.length > 0) {
    promptSections.push(`Hard constraints:\n- ${enhancement.constraints.join("\n- ")}`);
  }

  if (enhancement.negativeConstraints.length > 0) {
    promptSections.push(`Negative constraints:\n- ${enhancement.negativeConstraints.join("\n- ")}`);
  }

  return promptSections.join("\n\n");
}

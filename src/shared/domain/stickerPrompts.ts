export const STICKER_VARIATION_BASE_PROMPT =
  '参考当前图片中的贴纸设计，让它看起来像同系列的新款贴纸';

export type StickerVariationPromptOptions = {
  colorScheme?: string;
  userPrompt?: string;
};

export function buildStickerVariationPrompt(options: StickerVariationPromptOptions = {}): string {
  const parts = [STICKER_VARIATION_BASE_PROMPT];
  const colorScheme = options.colorScheme?.trim();
  const userPrompt = options.userPrompt?.trim();

  if (colorScheme) {
    parts.push(`色调方向：${colorScheme}`);
  }

  if (userPrompt) {
    parts.push(`附加要求：${userPrompt}`);
  }

  return parts.join('。');
}

export const REPLACE_LOGO_BASE_PROMPT =
  '图1是需要编辑的原图，图2只作为新 Logo 参考。只替换原图中明显的品牌 Logo 或品牌文字区域，保持原位置、大小、透视、材质和光影贴合。不要重设计包装、产品、背景或其他文字。';

export function buildReplaceLogoPrompt(userPrompt?: string): string {
  const trimmedUserPrompt = userPrompt?.trim();
  if (!trimmedUserPrompt) {
    return REPLACE_LOGO_BASE_PROMPT;
  }

  return `${REPLACE_LOGO_BASE_PROMPT}。附加要求：${trimmedUserPrompt}`;
}

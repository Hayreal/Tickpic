export const ENGLISH_ONLY_VISIBLE_TEXT_RULE =
  '输出约束：画面中所有可见文字（标题、卖点、标签、Logo 文案、徽章、说明、装饰字体）必须为英文，不得出现任何中文字符。参考图、用户说明或结构化参数中的中文内容，须在画面中翻译为英文后再呈现。';

export const NO_GARBLED_TEXT_RULE =
  'Text quality constraint: All visible text must be clear, legible, correctly spelled, and composed of valid characters. Do not render garbled text, fake letters, random symbols, or meaningless pseudo-text.';

export function appendNoGarbledTextRule(prompt: string): string {
  const trimmed = prompt.trim();
  if (trimmed.includes(NO_GARBLED_TEXT_RULE)) {
    return trimmed;
  }
  return [trimmed, NO_GARBLED_TEXT_RULE].filter(Boolean).join('\n');
}

export function appendEnglishOnlyVisibleTextRule(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return ENGLISH_ONLY_VISIBLE_TEXT_RULE;
  }
  if (trimmed.includes('不得出现任何中文字符')) {
    return trimmed;
  }
  return `${trimmed}\n${ENGLISH_ONLY_VISIBLE_TEXT_RULE}`;
}

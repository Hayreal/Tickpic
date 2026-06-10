import { describe, expect, it } from 'vitest';
import { appendEnglishOnlyVisibleTextRule, ENGLISH_ONLY_VISIBLE_TEXT_RULE } from '../imageOutputRules';

describe('imageOutputRules', () => {
  it('appends the English-only visible text rule once', () => {
    const prompt = appendEnglishOnlyVisibleTextRule('生成一张电商主图。');

    expect(prompt).toContain('生成一张电商主图。');
    expect(prompt).toContain(ENGLISH_ONLY_VISIBLE_TEXT_RULE);
    expect(prompt.match(/不得出现任何中文字符/g)).toHaveLength(1);
  });

  it('does not duplicate the rule when it is already present', () => {
    const prompt = appendEnglishOnlyVisibleTextRule(
      `生成一张电商主图。\n${ENGLISH_ONLY_VISIBLE_TEXT_RULE}`,
    );

    expect(prompt.match(/不得出现任何中文字符/g)).toHaveLength(1);
  });
});

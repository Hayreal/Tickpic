import React from 'react';
import { MAX_NEGATIVE_PROMPT_LENGTH } from '../shared/domain/imageFeatureApi';
import type { SkuSubTab } from '../shared/view/ui';

interface SkuNegativePromptFieldProps {
  prefix: SkuSubTab;
  value: string;
  onChange: (value: string) => void;
}

export default function SkuNegativePromptField({
  prefix,
  value,
  onChange,
}: SkuNegativePromptFieldProps) {
  const id = `${prefix}-negative-prompt-input`;

  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <label className="ui-label" htmlFor={id}>反向提示词</label>
        <span className="text-[10px] text-muted-foreground">
          {value.length} / {MAX_NEGATIVE_PROMPT_LENGTH}
        </span>
      </div>
      <textarea
        id={id}
        aria-label="反向提示词"
        maxLength={MAX_NEGATIVE_PROMPT_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="输入不希望出现的文字、元素或效果；支持多行"
        className="ui-textarea h-20 text-xs"
      />
      <p className="text-[10px] leading-4 text-muted-foreground">
        例如：不要海绵、不要旁边道具、不要假英文、不要医疗功效词。
      </p>
    </div>
  );
}

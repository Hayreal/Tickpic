import React from 'react';
import { MAX_NEGATIVE_PROMPT_LENGTH } from '../shared/domain/imageFeatureApi';

interface StickerNegativePromptFieldProps {
  prefix: 'copy' | 'variation' | 'original';
  value: string;
  onChange: (value: string) => void;
}

export default function StickerNegativePromptField({
  prefix,
  value,
  onChange,
}: StickerNegativePromptFieldProps) {
  const id = `${prefix}-negative-prompt-input`;

  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <label className="ui-label" htmlFor={id}>负面提示词</label>
        <span className="text-[10px] text-muted-foreground">
          {value.length} / {MAX_NEGATIVE_PROMPT_LENGTH}
        </span>
      </div>
      <textarea
        id={id}
        aria-label="负面提示词"
        maxLength={MAX_NEGATIVE_PROMPT_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="输入不希望图片中出现的文字、元素或效果；支持多行"
        className="ui-textarea h-20 text-xs"
      />
      <p className="text-[10px] leading-4 text-muted-foreground">
        例如：禁止 BEST、NO.1、100%；不要医疗功效词；不要金色渐变。
      </p>
    </div>
  );
}

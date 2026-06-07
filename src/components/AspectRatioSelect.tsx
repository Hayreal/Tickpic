import React from 'react';
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  IMAGE_ASPECT_RATIO_OPTIONS,
  type ImageAspectRatioValue,
} from '../shared/view/imageAspectRatioOptions';

interface AspectRatioSelectProps {
  value: ImageAspectRatioValue;
  onChange: (value: ImageAspectRatioValue) => void;
  id?: string;
  label?: string;
}

export default function AspectRatioSelect({
  value,
  onChange,
  id,
  label = '图片比例',
}: AspectRatioSelectProps) {
  return (
    <div className="space-y-2">
      <label className="ui-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as ImageAspectRatioValue)}
        className="ui-select font-mono"
      >
        {IMAGE_ASPECT_RATIO_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.value}　{option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export { DEFAULT_IMAGE_ASPECT_RATIO };

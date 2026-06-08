import {
  DEFAULT_IMAGE_COUNT,
  IMAGE_COUNT_OPTIONS,
  type ImageCountValue,
} from '../shared/view/imageCountOptions';

interface ImageCountSelectorProps {
  value: number;
  onChange: (value: ImageCountValue) => void;
  id?: string;
  label?: string;
}

export default function ImageCountSelector({
  value,
  onChange,
  id,
  label = '生成数量',
}: ImageCountSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="ui-label" htmlFor={id}>
        {label}
      </label>
      <div className="grid grid-cols-4 gap-2" id={id}>
        {IMAGE_COUNT_OPTIONS.map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => onChange(num)}
            className={`cursor-pointer py-2 rounded-lg text-xs font-bold transition-all border ${
              value === num ? 'ui-segment-active' : 'ui-segment-inactive'
            }`}
          >
            {num} 张
          </button>
        ))}
      </div>
    </div>
  );
}

export { DEFAULT_IMAGE_COUNT, IMAGE_COUNT_OPTIONS };

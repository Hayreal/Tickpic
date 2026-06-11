import {
  STICKER_PRODUCT_RATIO_NONE,
  STICKER_PRODUCT_RATIO_OPTIONS,
  resolveStickerProductRatio,
  type StickerProductRatioSelection,
} from '../shared/view/stickerProductRatioOptions';

interface StickerProductRatioSelectProps {
  value: StickerProductRatioSelection;
  onChange: (value: StickerProductRatioSelection) => void;
  id?: string;
  label?: string;
}

export default function StickerProductRatioSelect({
  value,
  onChange,
  id,
  label = '产品比例',
}: StickerProductRatioSelectProps) {
  const selected = resolveStickerProductRatio(value || undefined);

  return (
    <div className="space-y-2">
      <label className="ui-label" htmlFor={id}>
        {label}
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" id={id}>
        <button
          type="button"
          onClick={() => onChange(STICKER_PRODUCT_RATIO_NONE)}
          className={`cursor-pointer rounded-lg border px-2 py-2 text-xs font-bold transition-all ${
            selected === STICKER_PRODUCT_RATIO_NONE ? 'ui-segment-active' : 'ui-segment-inactive'
          }`}
        >
          不指定
        </button>
        {STICKER_PRODUCT_RATIO_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`cursor-pointer rounded-lg border px-2 py-2 text-xs font-bold transition-all ${
              selected === option.value ? 'ui-segment-active' : 'ui-segment-inactive'
            }`}
          >
            <span className="block">{option.label}</span>
            <span className="mt-0.5 block font-mono text-[10px] font-semibold opacity-80">{option.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

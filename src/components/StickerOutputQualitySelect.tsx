import { cn } from '@/src/lib/utils';
import {
  STICKER_OUTPUT_QUALITIES,
  type StickerOutputQuality,
} from '../shared/domain/stickerOutputSpec';

interface StickerOutputQualitySelectProps {
  value: StickerOutputQuality;
  onChange: (value: StickerOutputQuality) => void;
}

export default function StickerOutputQualitySelect({
  value,
  onChange,
}: StickerOutputQualitySelectProps) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="ui-label">清晰度</p>
      <div
        role="group"
        aria-label="清晰度"
        className="grid h-9 grid-cols-2 rounded-md border border-input bg-background p-0.5 shadow-sm"
      >
        {STICKER_OUTPUT_QUALITIES.map((quality) => {
          const selected = quality === value;
          return (
            <button
              key={quality}
              type="button"
              aria-label={quality}
              aria-pressed={selected}
              onClick={() => onChange(quality)}
              className={cn(
                'rounded px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
              )}
            >
              {quality}
            </button>
          );
        })}
      </div>
    </div>
  );
}

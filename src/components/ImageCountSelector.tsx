import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  DEFAULT_IMAGE_COUNT,
  IMAGE_COUNT_OPTIONS,
  resolveImageCount,
  type ImageCountValue,
} from '../shared/view/imageCountOptions';

interface ImageCountSelectorProps {
  value: number;
  onChange: (value: ImageCountValue) => void;
  id?: string;
  label?: string;
  options?: readonly ImageCountValue[];
}

export default function ImageCountSelector({
  value,
  onChange,
  id,
  label = '生成数量',
  options = IMAGE_COUNT_OPTIONS,
}: ImageCountSelectorProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = (options as readonly number[]).includes(value)
    ? (value as ImageCountValue)
    : resolveImageCount(value);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className={cn('relative min-w-0 space-y-2', open && 'z-30')} ref={containerRef}>
      <label className="ui-label" htmlFor={id}>
        {label}
      </label>
      <button
        type="button"
        id={id}
        aria-label={`${label} ${selected} 张`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-xs shadow-sm transition-colors',
          'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open && 'border-primary/50 ring-2 ring-ring/30',
        )}
      >
        <span className="min-w-0 truncate font-semibold text-foreground">{selected} 张</span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          <ul
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="overflow-auto p-1.5"
          >
            {options.map((num) => {
              const isSelected = num === selected;
              return (
                <li key={num} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(num);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs transition-colors',
                      isSelected
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent/60',
                    )}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      {isSelected ? <Check className="size-3.5 text-primary" /> : null}
                    </span>
                    <span className="font-semibold">{num} 张</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export { DEFAULT_IMAGE_COUNT, IMAGE_COUNT_OPTIONS };

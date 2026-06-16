import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  REPLACE_PRODUCT_MODEL_DEFAULT,
  REPLACE_PRODUCT_MODEL_OPTIONS,
  type ReplaceProductModelSelection,
} from '../shared/view/replaceProductModelOptions';

interface ReplaceProductModelSelectProps {
  value: ReplaceProductModelSelection;
  onChange: (value: ReplaceProductModelSelection) => void;
  id?: string;
  label?: string;
}

export default function ReplaceProductModelSelect({
  value,
  onChange,
  id,
  label = '替换模型',
}: ReplaceProductModelSelectProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = REPLACE_PRODUCT_MODEL_OPTIONS.find((option) => option.value === value)
    ?? REPLACE_PRODUCT_MODEL_OPTIONS[0];

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
        aria-label={`${label} ${selected.label}`}
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
        <span className="min-w-0 truncate font-semibold text-foreground">{selected.label}</span>
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
            {REPLACE_PRODUCT_MODEL_OPTIONS.map((option) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-xs transition-colors',
                      isSelected
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent/60',
                    )}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center pt-0.5">
                      {isSelected ? <Check className="size-3.5 text-primary" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{option.label}</span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">{option.description}</span>
                    </span>
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

export { REPLACE_PRODUCT_MODEL_DEFAULT };

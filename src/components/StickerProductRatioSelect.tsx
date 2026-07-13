import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  normalizeStickerAspectRatio,
  resolveStickerOutputSpec,
  type StickerOutputQuality,
} from '../shared/domain/stickerOutputSpec';
import {
  STICKER_PRODUCT_RATIO_OPTIONS,
  isStickerProductRatioPreset,
  stickerProductRatioLabel,
} from '../shared/view/stickerProductRatioOptions';

interface StickerProductRatioSelectProps {
  value: string;
  outputQuality: StickerOutputQuality;
  resolvedAutoRatio?: string;
  onChange: (value: string) => void;
  onValidationChange?: (message?: string) => void;
  id?: string;
}

type RatioSelection = 'auto' | '__custom__' | typeof STICKER_PRODUCT_RATIO_OPTIONS[number]['value'];

const PRODUCT_RATIO_OPTIONS: Array<{
  value: RatioSelection;
  label: string;
  ratio?: string;
}> = [
  { value: 'auto', label: '自动' },
  ...STICKER_PRODUCT_RATIO_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    ratio: option.value,
  })),
  { value: '__custom__', label: '自定义' },
];

function ratioSelection(value: string): RatioSelection {
  if (value === 'auto' || value === '__custom__' || isStickerProductRatioPreset(value)) {
    return value;
  }
  return '__custom__';
}

function customRatioParts(value: string): [string, string] {
  if (ratioSelection(value) !== '__custom__' || value === '__custom__') {
    return ['', ''];
  }

  const [width = '', height = ''] = value.split(':', 2);
  return [width, height];
}

function ratioDisplayLabel(selection: RatioSelection, customRatio?: string): string {
  if (selection === 'auto') {
    return '自动';
  }
  if (selection === '__custom__') {
    return customRatio ? `自定义 · ${customRatio}` : '自定义';
  }
  return `${stickerProductRatioLabel(selection)} · ${selection}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '产品比例无效';
}

export default function StickerProductRatioSelect({
  value,
  outputQuality,
  resolvedAutoRatio,
  onChange,
  onValidationChange,
  id,
}: StickerProductRatioSelectProps) {
  const generatedId = useId();
  const listboxId = useId();
  const controlId = id ?? `${generatedId}-trigger`;
  const errorId = `${controlId}-error`;
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const onChangeRef = useRef(onChange);
  const onValidationChangeRef = useRef(onValidationChange);
  const previousValueRef = useRef(value);
  const lastEmittedRatioRef = useRef<string>();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<RatioSelection>(() => ratioSelection(value));
  const initialCustomParts = customRatioParts(value);
  const [customWidth, setCustomWidth] = useState(initialCustomParts[0]);
  const [customHeight, setCustomHeight] = useState(initialCustomParts[1]);
  const valueChangedSinceLastRender = previousValueRef.current !== value;

  onChangeRef.current = onChange;
  onValidationChangeRef.current = onValidationChange;

  useEffect(() => {
    const nextSelection = ratioSelection(value);
    previousValueRef.current = value;
    setSelection(nextSelection);
    lastEmittedRatioRef.current = nextSelection === '__custom__' && value !== '__custom__'
      ? value
      : undefined;
    if (nextSelection === '__custom__' && value !== '__custom__') {
      const [width, height] = customRatioParts(value);
      setCustomWidth(width);
      setCustomHeight(height);
    }
  }, [value]);

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
        triggerRef.current?.focus();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => () => {
    onValidationChangeRef.current?.(undefined);
  }, []);

  const customResult = useMemo(() => {
    if (selection !== '__custom__') {
      return undefined;
    }
    if (!customWidth || !customHeight) {
      return { error: '请输入完整的产品比例' } as const;
    }
    try {
      const ratio = normalizeStickerAspectRatio(`${customWidth}:${customHeight}`);
      return { ratio, spec: resolveStickerOutputSpec(ratio, outputQuality) } as const;
    } catch (error) {
      return { error: errorMessage(error) } as const;
    }
  }, [customHeight, customWidth, outputQuality, selection]);

  const automaticSpec = useMemo(() => {
    if (selection !== 'auto' || !resolvedAutoRatio) {
      return undefined;
    }
    try {
      return resolveStickerOutputSpec(resolvedAutoRatio, outputQuality);
    } catch {
      return undefined;
    }
  }, [outputQuality, resolvedAutoRatio, selection]);

  const presetSpec = useMemo(() => {
    if (!isStickerProductRatioPreset(selection)) {
      return undefined;
    }
    return resolveStickerOutputSpec(selection, outputQuality);
  }, [outputQuality, selection]);

  useEffect(() => {
    if (selection !== '__custom__') {
      onValidationChangeRef.current?.(undefined);
      return;
    }
    if (!customResult || 'error' in customResult) {
      onValidationChangeRef.current?.(customResult?.error);
      return;
    }

    onValidationChangeRef.current?.(undefined);
    if (
      !valueChangedSinceLastRender
      && value !== customResult.ratio
      && lastEmittedRatioRef.current !== customResult.ratio
    ) {
      lastEmittedRatioRef.current = customResult.ratio;
      onChangeRef.current(customResult.ratio);
    }
  }, [customResult, selection, value, valueChangedSinceLastRender]);

  const updateCustomRatio = (width: string, height: string) => {
    if (!width || !height) {
      onValidationChangeRef.current?.('请输入完整的产品比例');
      return;
    }
    try {
      const ratio = normalizeStickerAspectRatio(`${width}:${height}`);
      resolveStickerOutputSpec(ratio, outputQuality);
      onValidationChangeRef.current?.(undefined);
      if (value === ratio) {
        lastEmittedRatioRef.current = ratio;
      } else if (lastEmittedRatioRef.current !== ratio) {
        lastEmittedRatioRef.current = ratio;
        onChangeRef.current(ratio);
      }
    } catch (error) {
      onValidationChangeRef.current?.(errorMessage(error));
    }
  };

  const selectOption = (nextSelection: RatioSelection) => {
    setSelection(nextSelection);
    setOpen(false);
    if (nextSelection === '__custom__') {
      updateCustomRatio(customWidth, customHeight);
      return;
    }
    lastEmittedRatioRef.current = undefined;
    onValidationChangeRef.current?.(undefined);
    onChangeRef.current(nextSelection);
  };

  const hasCustomError = selection === '__custom__'
    && Boolean(customResult && 'error' in customResult);
  const displayLabel = ratioDisplayLabel(
    selection,
    selection === '__custom__' && customResult && !('error' in customResult)
      ? customResult.ratio
      : undefined,
  );

  return (
    <div className={cn('relative min-w-0 space-y-2', open && 'z-30')} ref={containerRef}>
      <label className="ui-label" htmlFor={controlId}>
        产品比例
      </label>
      <button
        ref={triggerRef}
        type="button"
        id={controlId}
        aria-label={`产品比例 ${displayLabel}`}
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
        <span className="min-w-0 truncate font-semibold text-foreground">
          {displayLabel}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          <ul
            id={listboxId}
            role="listbox"
            aria-label="产品比例"
            className="max-h-64 overflow-auto p-1.5"
          >
            {PRODUCT_RATIO_OPTIONS.map((option) => {
              const isSelected = option.value === selection;
              return (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectOption(option.value)}
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
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{option.label}</span>
                      {option.ratio ? (
                        <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{option.ratio}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {selection === '__custom__' ? (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              aria-label="比例宽"
              aria-invalid={hasCustomError}
              aria-describedby={hasCustomError ? errorId : undefined}
              value={customWidth}
              onChange={(event) => {
                const nextWidth = event.target.value;
                setCustomWidth(nextWidth);
                updateCustomRatio(nextWidth, customHeight);
              }}
              className="h-9 min-w-0 rounded-md border border-input bg-background px-3 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="text-xs text-muted-foreground">:</span>
            <input
              type="text"
              inputMode="decimal"
              aria-label="比例高"
              aria-invalid={hasCustomError}
              aria-describedby={hasCustomError ? errorId : undefined}
              value={customHeight}
              onChange={(event) => {
                const nextHeight = event.target.value;
                setCustomHeight(nextHeight);
                updateCustomRatio(customWidth, nextHeight);
              }}
              className="h-9 min-w-0 rounded-md border border-input bg-background px-3 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {customResult && 'error' in customResult ? (
            <p id={errorId} role="alert" className="text-xs text-destructive">{customResult.error}</p>
          ) : customResult ? (
            <p className="text-xs text-muted-foreground">
              {customResult.ratio} · {outputQuality} → {customResult.spec.width} × {customResult.spec.height} px
            </p>
          ) : null}
        </div>
      ) : selection === 'auto' ? (
        <p className="text-xs text-muted-foreground">
          {automaticSpec
            ? `跟随原图比例 · ${automaticSpec.aspectRatio} · ${outputQuality} → ${automaticSpec.width} × ${automaticSpec.height} px`
            : '跟随原图比例'}
        </p>
      ) : presetSpec ? (
        <p className="text-xs text-muted-foreground">
          {presetSpec.aspectRatio} · {outputQuality} → {presetSpec.width} × {presetSpec.height} px
        </p>
      ) : null}
    </div>
  );
}

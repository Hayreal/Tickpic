import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import AspectRatioIcon from './AspectRatioIcon';
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  filterAspectRatioOptions,
  IMAGE_ASPECT_RATIO_OPTIONS,
  type ImageAspectRatioValue,
} from '../shared/view/imageAspectRatioOptions';
import { cn } from '@/src/lib/utils';

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
  const listboxId = useId();
  const searchInputId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = IMAGE_ASPECT_RATIO_OPTIONS.find((option) => option.value === value)
    ?? IMAGE_ASPECT_RATIO_OPTIONS[0];

  const filteredOptions = useMemo(
    () => filterAspectRatioOptions(query),
    [query],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    searchInputRef.current?.focus();

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const closeDropdown = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="ui-label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          id={id}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-xs shadow-sm transition-colors',
            'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            open && 'border-primary/40 ring-2 ring-ring/30',
          )}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <AspectRatioIcon value={selected.value} />
            <span className="font-mono font-semibold text-foreground">{selected.value}</span>
            <span className="truncate text-muted-foreground">{selected.description}</span>
          </span>
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full min-w-[280px] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
            <div className="border-b border-border px-3 py-2">
              <p className="mb-2 text-[11px] font-medium text-muted-foreground">比例</p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  id={searchInputId}
                  type="search"
                  value={query}
                  placeholder="搜索比例，如 1:1、主图、详情页"
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            <ul
              id={listboxId}
              role="listbox"
              aria-label={label}
              className="max-h-64 overflow-auto p-1.5"
            >
              {filteredOptions.length === 0 ? (
                <li className="px-2.5 py-6 text-center text-xs text-muted-foreground">
                  未找到匹配的比例
                </li>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <li key={option.value} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onChange(option.value);
                          closeDropdown();
                        }}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-3 rounded-md px-2.5 py-2.5 text-left text-xs transition-colors',
                          isSelected
                            ? 'bg-accent text-accent-foreground'
                            : 'text-foreground hover:bg-accent/60',
                        )}
                      >
                        <AspectRatioIcon value={option.value} />
                        <span className="w-10 shrink-0 font-mono font-semibold">{option.value}</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{option.description}</span>
                        {isSelected ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export { DEFAULT_IMAGE_ASPECT_RATIO };

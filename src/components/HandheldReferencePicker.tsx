import React, { useEffect, useState } from 'react';
import type { ResolvedProductHandheldReference } from '../shared/contracts/desktop';
import { useDesktopClient } from '../hooks/useDesktopClient';
import { toDisplaySrc } from '../lib/fileUrl';
import { cn } from '@/src/lib/utils';
import { REFERENCE_FIELD_SPAN } from './FeatureParameterPanels';

interface HandheldReferencePickerProps {
  value: string | null;
  onChange: (referenceId: string | null) => void;
}

export default function HandheldReferencePicker({ value, onChange }: HandheldReferencePickerProps) {
  const desktopClient = useDesktopClient();
  const [references, setReferences] = useState<ResolvedProductHandheldReference[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void desktopClient?.resources.listHandheldReferences()
      .then((items) => {
        if (!cancelled) {
          setReferences(items);
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : '加载手持参考图失败');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [desktopClient]);

  return (
    <div className={REFERENCE_FIELD_SPAN}>
      <div className="space-y-2">
        <span className="ui-label">手持参考图（可选）</span>
        <p className="text-xs text-muted-foreground">
          选择后将按参考图的手势与握持形态生成；不选则由 AI 自由发挥。
        </p>
      </div>
      {loadError ? (
        <p className="mt-2 text-xs text-destructive">{loadError}</p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {references.map((reference) => {
            const selected = value === reference.id;
            return (
              <button
                key={reference.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(selected ? null : reference.id)}
                className={cn(
                  'overflow-hidden rounded-lg border bg-muted/20 text-left transition-colors',
                  selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50',
                )}
              >
                <div className="aspect-square bg-black">
                  <img
                    src={toDisplaySrc(reference.path)}
                    alt={reference.label}
                    className="size-full object-contain"
                  />
                </div>
                <p className="px-2 py-1.5 text-[11px] leading-tight text-foreground">{reference.label}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function resolveHandheldReferencePath(
  references: ResolvedProductHandheldReference[],
  referenceId: string | null,
) {
  if (!referenceId) {
    return null;
  }
  return references.find((reference) => reference.id === referenceId)?.path ?? null;
}

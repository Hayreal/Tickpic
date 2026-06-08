import { cn } from '@/src/lib/utils';

interface AspectRatioIconProps {
  value: string;
  className?: string;
}

export default function AspectRatioIcon({ value, className }: AspectRatioIconProps) {
  if (value === 'auto') {
    return (
      <div
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border border-dashed border-foreground/50',
          className,
        )}
        aria-hidden
      >
        <span className="text-[8px] font-mono font-semibold text-muted-foreground">A</span>
      </div>
    );
  }

  const [widthRatio, heightRatio] = value.split(':').map(Number);
  const maxSize = 18;
  const scale = maxSize / Math.max(widthRatio, heightRatio);
  const width = Math.max(4, Math.round(widthRatio * scale));
  const height = Math.max(4, Math.round(heightRatio * scale));

  return (
    <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center', className)} aria-hidden>
      <div
        className="rounded-[2px] border border-foreground/80"
        style={{ width, height }}
      />
    </div>
  );
}

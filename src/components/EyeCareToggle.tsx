import { Moon } from 'lucide-react';

import { useAppearance } from '../contexts/AppearanceContext';
import { Label } from '@/src/components/ui/label';
import { Switch } from '@/src/components/ui/switch';
import { cn } from '@/src/lib/utils';

interface EyeCareToggleProps {
  layout?: 'row' | 'stack';
  className?: string;
  showDescription?: boolean;
  switchId?: string;
}

export default function EyeCareToggle({
  layout = 'row',
  className,
  showDescription = true,
  switchId = 'eye-care-switch',
}: EyeCareToggleProps) {
  const { eyeCareMode, setEyeCareMode } = useAppearance();

  return (
    <div
      className={cn(
        layout === 'row'
          ? 'flex items-center justify-between gap-4'
          : 'flex flex-col gap-3',
        className,
      )}
      id="eye-care-toggle"
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Moon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <Label htmlFor={switchId} className="text-sm font-medium text-foreground">
            护眼模式
          </Label>
          {showDescription && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              切换为暖色低蓝光界面，减轻长时间作图时的视觉疲劳。
            </p>
          )}
        </div>
      </div>
      <Switch
        id={switchId}
        checked={eyeCareMode}
        onCheckedChange={setEyeCareMode}
        aria-label="护眼模式"
      />
    </div>
  );
}

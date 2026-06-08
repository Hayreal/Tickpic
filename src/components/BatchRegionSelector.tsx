import type { ImageRole, RegionInput } from '../shared/domain/imageFeatureApi';
import type { RegionMap } from '../lib/regionSelection';
import { setRegionForPath } from '../lib/regionSelection';
import RegionSelector from './RegionSelector';
import { UI } from '../shared/view/design';
import { REFERENCE_FIELD_SPAN } from './FeatureParameterPanels';
import { Badge } from '@/src/components/ui/badge';
import { cn } from '@/src/lib/utils';

interface BatchRegionImage {
  path: string;
  label?: string;
}

interface BatchRegionSelectorProps {
  images: BatchRegionImage[];
  imageRole: ImageRole;
  regions: RegionMap;
  onRegionsChange: (regions: RegionMap) => void;
  operationHint?: string;
  label?: string;
  className?: string;
}

export default function BatchRegionSelector({
  images,
  imageRole,
  regions,
  onRegionsChange,
  operationHint,
  label = '框选区域 (可选)',
  className,
}: BatchRegionSelectorProps) {
  if (images.length === 0) {
    return null;
  }

  const selectedCount = images.filter((image) => regions[image.path]).length;

  return (
    <div className={cn(REFERENCE_FIELD_SPAN, 'space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <label className="ui-label">{label}</label>
        {images.length > 1 ? (
          <Badge variant="secondary" className="font-mono text-[10px]">
            {selectedCount}/{images.length} 已框选
          </Badge>
        ) : null}
      </div>

      <div className={UI.uploadTileGrid}>
        {images.map((image) => (
          <div key={image.path}>
            <RegionSelector
              imagePath={image.path}
              imageRole={imageRole}
              region={regions[image.path] ?? null}
              onRegionChange={(nextRegion) => onRegionsChange(setRegionForPath(regions, image.path, nextRegion))}
              operationHint={operationHint}
              caption={image.label}
              tile
            />
          </div>
        ))}
      </div>
    </div>
  );
}

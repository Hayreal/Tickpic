import React from 'react';
import { X } from 'lucide-react';
import { UI } from '../shared/view/design';
import { toDisplaySrc } from '../lib/fileUrl';
import { Button } from '@/src/components/ui/button';

interface ImagePreviewFallbackModalProps {
  filePath: string;
  fileName: string;
  onClose: () => void;
}

export default function ImagePreviewFallbackModal({
  filePath,
  fileName,
  onClose,
}: ImagePreviewFallbackModalProps) {
  return (
    <div className={UI.modalOverlay} onClick={onClose}>
      <div className={UI.modal} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-mono truncate">{fileName}</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 flex items-center justify-center bg-muted/30 min-h-[240px]">
          <img src={toDisplaySrc(filePath)} alt={fileName} className="max-h-[65vh] object-contain" />
        </div>
      </div>
    </div>
  );
}

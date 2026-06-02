// Re-export shared domain types for backward compatibility
export type { TaskRecord, TaskStatus } from './shared/domain/tasks';
export type { ImportBatch, StoredImageRecord } from './shared/domain/images';
export type { AppSettings } from './shared/domain/settings';
export type { TaskItem } from './shared/view/tasks';

// UI-specific types (not part of domain refactor)
export type ActiveTab = 'sticker' | 'product' | 'settings' | 'profile';

export type StickerSubTab = 'copy' | 'variation' | 'original';

export type ProductSubTab = 'remove' | 'replace' | 'logo' | 'theme' | 'scene';

export interface ResultItem {
  id: string;
  imageUrl: string;
  taskId?: string;
  timestamp?: string;
  badge?: string;
}

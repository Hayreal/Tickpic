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

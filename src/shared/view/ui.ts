export type ActiveTab = 'sticker' | 'product' | 'settings' | 'profile';

export type StickerSubTab = 'copy' | 'variation' | 'original';

export type ProductSubTab =
  | 'remove'
  | 'replace'
  | 'logo'
  | 'theme'
  | 'sceneVariation'
  | 'scene'
  | 'promptAsset';

export interface ResultItem {
  id: string;
  imageUrl: string;
  taskId?: string;
  timestamp?: string;
  badge?: string;
}

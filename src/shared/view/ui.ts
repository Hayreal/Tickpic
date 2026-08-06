export type ActiveTab = 'sticker' | 'product' | 'productSet' | 'settings' | 'profile';

export type StickerSubTab = 'copy' | 'variation' | 'original';

export type ProductSubTab =
  | 'remove'
  | 'replace'
  | 'logo'
  | 'theme'
  | 'sceneVariation'
  | 'scene'
  | 'promptAsset';

export type ProductSetSubTab = 'main' | 'comparison' | 'multiScene';

export interface ResultItem {
  id: string;
  imageUrl: string;
  taskId?: string;
  timestamp?: string;
  badge?: string;
}

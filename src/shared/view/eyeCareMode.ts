export const EYE_CARE_STORAGE_KEY = 'tickpic-eye-care-mode';

export function readEyeCareMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(EYE_CARE_STORAGE_KEY) === 'true';
}

export function writeEyeCareMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(EYE_CARE_STORAGE_KEY, String(enabled));
}

export function applyEyeCareClass(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('eye-care', enabled);
}

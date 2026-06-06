import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyEyeCareClass,
  readEyeCareMode,
  writeEyeCareMode,
} from '../shared/view/eyeCareMode';

interface AppearanceContextValue {
  eyeCareMode: boolean;
  setEyeCareMode: (enabled: boolean) => void;
  toggleEyeCareMode: () => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [eyeCareMode, setEyeCareModeState] = useState(() => readEyeCareMode());

  const setEyeCareMode = useCallback((enabled: boolean) => {
    setEyeCareModeState(enabled);
    writeEyeCareMode(enabled);
    applyEyeCareClass(enabled);
  }, []);

  const toggleEyeCareMode = useCallback(() => {
    setEyeCareMode(!eyeCareMode);
  }, [eyeCareMode, setEyeCareMode]);

  useEffect(() => {
    applyEyeCareClass(eyeCareMode);
  }, [eyeCareMode]);

  const value = useMemo(
    () => ({ eyeCareMode, setEyeCareMode, toggleEyeCareMode }),
    [eyeCareMode, setEyeCareMode, toggleEyeCareMode],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error('useAppearance must be used within AppearanceProvider');
  }
  return context;
}

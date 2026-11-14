import React, { createContext, useContext, useState } from 'react';
import type { ViewMode } from '../types';

interface ViewModeContextValue {
  viewMode: ViewMode;
  isSimpleMode: boolean;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
}

const STORAGE_KEY = 'cropcast_view_mode_v1';

const ViewModeContext = createContext<ViewModeContextValue>({
  viewMode: 'simple',
  isSimpleMode: true,
  setViewMode: () => {},
  toggleViewMode: () => {},
});

export const ViewModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'detailed' ? 'detailed' : 'simple';
    } catch {
      return 'simple';
    }
  });

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore storage errors
    }
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'simple' ? 'detailed' : 'simple');
  };

  return (
    <ViewModeContext.Provider
      value={{
        viewMode,
        isSimpleMode: viewMode === 'simple',
        setViewMode,
        toggleViewMode,
      }}
    >
      {children}
    </ViewModeContext.Provider>
  );
};

export function useViewMode() {
  return useContext(ViewModeContext);
}

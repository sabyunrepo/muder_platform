import { useContext } from 'react';
import { AppearanceContext, type AppearanceContextValue } from './appearanceContext';

export function useAppearance(): AppearanceContextValue {
  const value = useContext(AppearanceContext);
  if (!value) {
    throw new Error('useAppearance must be used inside AppearanceProvider');
  }
  return value;
}

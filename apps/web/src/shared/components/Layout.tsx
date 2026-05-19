import type { ReactNode } from 'react';
import { PublicThemeShell } from './PublicThemeShell';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return <PublicThemeShell>{children}</PublicThemeShell>;
}

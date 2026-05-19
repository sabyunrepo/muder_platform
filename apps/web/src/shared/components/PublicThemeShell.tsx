import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ThemeModeToggle } from '@/shared/components/ui';

interface PublicThemeShellProps {
  children: ReactNode;
  center?: boolean;
}

export function PublicThemeShell({ children, center = false }: PublicThemeShellProps) {
  return (
    <div className="min-h-screen bg-[var(--mmp-color-canvas)] text-[var(--mmp-color-ink)]">
      <header className="flex min-h-16 items-center justify-between gap-3 border-b border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] px-4 shadow-sm sm:px-6">
        <Link to="/" className="text-lg font-semibold text-[var(--mmp-color-primary)]">
          MMP
        </Link>
        <div className="sm:hidden">
          <ThemeModeToggle compact />
        </div>
        <div className="hidden sm:block">
          <ThemeModeToggle />
        </div>
      </header>
      <main
        className={
          center
            ? 'flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8'
            : 'min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6'
        }
      >
        {children}
      </main>
    </div>
  );
}

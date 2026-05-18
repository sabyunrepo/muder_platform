import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--mmp-color-canvas)] text-[var(--mmp-color-ink)]">
      <header className="flex h-16 items-center border-b border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] px-6">
        <span className="text-lg font-semibold text-[var(--mmp-color-primary)]">MMP</span>
      </header>
      <main>{children}</main>
    </div>
  );
}

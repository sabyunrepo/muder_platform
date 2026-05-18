import type { ReactNode } from 'react';

export interface PageShellProps {
  children: ReactNode;
  header?: ReactNode;
  className?: string;
}

export function PageShell({ children, header, className = '' }: PageShellProps) {
  return (
    <main className={`min-h-screen bg-[var(--mmp-color-canvas)] text-[var(--mmp-color-ink)] ${className}`}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {header}
        {children}
      </div>
    </main>
  );
}

import type { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="flex h-16 items-center border-b border-slate-800 px-6">
        <span className="text-lg font-semibold text-amber-500">MMP</span>
      </header>
      <main>{children}</main>
    </div>
  );
}

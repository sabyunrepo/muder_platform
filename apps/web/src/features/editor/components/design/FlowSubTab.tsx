import { GitBranch } from 'lucide-react';

// ---------------------------------------------------------------------------
// FlowSubTab — placeholder
// ---------------------------------------------------------------------------

export function FlowSubTab() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <GitBranch className="mx-auto mb-3 h-8 w-8 text-slate-700" />
        <p className="text-xs font-mono uppercase tracking-widest text-slate-700">
          페이즈 타임라인 — 다음 PR에서 구현
        </p>
      </div>
    </div>
  );
}

import { Layout } from 'lucide-react';

// ---------------------------------------------------------------------------
// AssignmentSubTab — placeholder
// ---------------------------------------------------------------------------

export function AssignmentSubTab() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <Layout className="mx-auto mb-3 h-8 w-8 text-slate-700" />
        <p className="text-xs font-mono uppercase tracking-widest text-slate-700">
          단서/캐릭터 배치 — 다음 PR에서 구현
        </p>
      </div>
    </div>
  );
}

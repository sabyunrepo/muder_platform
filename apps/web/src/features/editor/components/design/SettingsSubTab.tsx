import { Settings } from 'lucide-react';

// ---------------------------------------------------------------------------
// SettingsSubTab — placeholder
// ---------------------------------------------------------------------------

export function SettingsSubTab() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <Settings className="mx-auto mb-3 h-8 w-8 text-slate-700" />
        <p className="text-xs font-mono uppercase tracking-widest text-slate-700">
          모듈 설정 — 다음 PR에서 구현
        </p>
      </div>
    </div>
  );
}

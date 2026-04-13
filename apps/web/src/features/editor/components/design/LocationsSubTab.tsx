import { MapPin } from 'lucide-react';

// ---------------------------------------------------------------------------
// LocationsSubTab — placeholder
// ---------------------------------------------------------------------------

export function LocationsSubTab() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <MapPin className="mx-auto mb-3 h-8 w-8 text-slate-700" />
        <p className="text-xs font-mono uppercase tracking-widest text-slate-700">
          맵/장소 관리 — 다음 PR에서 구현
        </p>
      </div>
    </div>
  );
}

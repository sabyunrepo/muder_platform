import { useEffect, useState } from 'react';
import { MapPin, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { LocationResponse } from '@/features/editor/api';
import { useUpdateLocation } from '@/features/editor/api';

// ---------------------------------------------------------------------------
// LocationRow — name + inline round schedule editor + delete.
// Round inputs commit on blur (and on Enter) via useUpdateLocation. Local
// state mirrors the server value so optimistic re-rendering is avoided —
// react-query invalidation handles the refresh.
// ---------------------------------------------------------------------------

interface LocationRowProps {
  themeId: string;
  location: LocationResponse;
  onDelete: (id: string) => void;
}

function parseRound(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

export function LocationRow({ themeId, location, onDelete }: LocationRowProps) {
  const updateLocation = useUpdateLocation(themeId);

  const [fromRound, setFromRound] = useState<number | null>(
    location.from_round ?? null,
  );
  const [untilRound, setUntilRound] = useState<number | null>(
    location.until_round ?? null,
  );

  // Keep local state in sync when server data refreshes (e.g. after PATCH).
  useEffect(() => {
    setFromRound(location.from_round ?? null);
    setUntilRound(location.until_round ?? null);
  }, [location.from_round, location.until_round]);

  function commitRounds(nextFrom: number | null, nextUntil: number | null) {
    if (
      nextFrom === (location.from_round ?? null) &&
      nextUntil === (location.until_round ?? null)
    ) {
      return;
    }
    if (nextFrom != null && nextUntil != null && nextFrom > nextUntil) {
      toast.error('등장 라운드는 퇴장 라운드보다 클 수 없습니다');
      setFromRound(location.from_round ?? null);
      setUntilRound(location.until_round ?? null);
      return;
    }
    updateLocation.mutate(
      {
        locationId: location.id,
        body: {
          name: location.name,
          sort_order: location.sort_order,
          from_round: nextFrom,
          until_round: nextUntil,
        },
      },
      {
        onError: () => {
          toast.error('라운드 저장에 실패했습니다');
          setFromRound(location.from_round ?? null);
          setUntilRound(location.until_round ?? null);
        },
      },
    );
  }

  return (
    <div className="group flex items-center gap-2 rounded-sm border border-slate-800 bg-slate-900 px-3 py-2 hover:border-slate-700">
      <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-600" />
      <span className="flex-1 truncate text-xs font-medium text-slate-300">
        {location.name}
      </span>
      <div className="flex items-center gap-1 text-[10px] text-slate-500">
        <label
          htmlFor={`location-${location.id}-from`}
          className="sr-only"
        >
          {location.name} 등장 라운드
        </label>
        <input
          id={`location-${location.id}-from`}
          type="number"
          min={1}
          step={1}
          placeholder="시작"
          aria-label={`${location.name} 등장 라운드`}
          value={fromRound ?? ''}
          onChange={(e) => setFromRound(parseRound(e.target.value))}
          onBlur={() => commitRounds(fromRound, untilRound)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="w-14 rounded-sm border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-center text-xs text-slate-200 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
        />
        <span>~</span>
        <label
          htmlFor={`location-${location.id}-until`}
          className="sr-only"
        >
          {location.name} 퇴장 라운드
        </label>
        <input
          id={`location-${location.id}-until`}
          type="number"
          min={1}
          step={1}
          placeholder="끝"
          aria-label={`${location.name} 퇴장 라운드`}
          value={untilRound ?? ''}
          onChange={(e) => setUntilRound(parseRound(e.target.value))}
          onBlur={() => commitRounds(fromRound, untilRound)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="w-14 rounded-sm border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-center text-xs text-slate-200 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
        />
      </div>
      <button
        type="button"
        onClick={() => onDelete(location.id)}
        aria-label={`${location.name} 삭제`}
        className="p-0.5 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

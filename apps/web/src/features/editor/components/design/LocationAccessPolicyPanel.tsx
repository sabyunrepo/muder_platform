import { LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { Spinner } from '@/shared/components/ui/Spinner';
import type { LocationResponse } from '@/features/editor/api';
import { getCharacterRoleOption } from '@/features/editor/entities/character/characterEditorAdapter';
import {
  formatLocationAccessLabel,
  parseLocationRestrictedCharacterIds,
  stringifyLocationRestrictedCharacterIds,
} from '@/features/editor/entities/location/locationEntityAdapter';
import { useEditorCharacters, useUpdateLocation } from '@/features/editor/api';
import { getDisplayErrorMessage } from '@/lib/display-error';

interface LocationAccessPolicyPanelProps {
  themeId: string;
  location: LocationResponse;
}

export function LocationAccessPolicyPanel({ themeId, location }: LocationAccessPolicyPanelProps) {
  const { data: characters, isLoading, isError, error, refetch } = useEditorCharacters(themeId);
  const updateLocation = useUpdateLocation(themeId);
  const restrictedSet = new Set(
    parseLocationRestrictedCharacterIds(location.restricted_characters)
  );
  const accessLabel = formatLocationAccessLabel(location.restricted_characters, characters ?? []);

  function toggleCharacter(characterId: string, restricted: boolean) {
    const next = new Set(restrictedSet);
    if (restricted) next.add(characterId);
    else next.delete(characterId);

    updateLocation.mutate(
      {
        locationId: location.id,
        body: {
          name: location.name,
          restricted_characters: stringifyLocationRestrictedCharacterIds(next),
          image_url: location.image_url,
          sort_order: location.sort_order,
          from_round: location.from_round ?? null,
          until_round: location.until_round ?? null,
        },
      },
      { onError: () => toast.error('접근 제한 저장에 실패했습니다') }
    );
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <div className="mb-3 flex items-start gap-2">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div>
          <p className="text-xs font-semibold text-slate-200">접근 제한</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            체크한 캐릭터는 이 장소에 들어오지 못합니다. 현재: {accessLabel}
          </p>
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
        </div>
      ) : isError ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-4 text-center text-xs text-red-100">
          <p>{getDisplayErrorMessage(error, '캐릭터 목록을 불러오지 못했습니다.')}</p>
          <button
            type="button"
            onClick={() => refetch?.()}
            className="mt-2 rounded-md border border-red-300/30 px-2 py-1 text-red-50 hover:bg-red-500/20"
          >
            다시 불러오기
          </button>
        </div>
      ) : !characters || characters.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-800 px-3 py-4 text-center text-xs text-slate-600">
          캐릭터가 없습니다.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {characters.map((character) => (
            <label
              key={character.id}
              className="flex items-start gap-2 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={restrictedSet.has(character.id)}
                disabled={updateLocation.isPending}
                onChange={(event) => toggleCharacter(character.id, event.target.checked)}
                className="mt-1 accent-amber-500"
              />
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-200">{character.name}</span>
                <span className="block text-xs text-slate-500">
                  {getCharacterRoleOption(character.mystery_role).label}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}

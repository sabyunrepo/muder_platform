import { CheckCircle, LockKeyhole, UserRound } from 'lucide-react';

import type { ThemeCharacterSummary } from '@/features/lobby/api';
import { Badge, Button, Card } from '@/shared/components/ui';

interface CharacterSelectionPanelProps {
  characters: ThemeCharacterSummary[];
  selectedCharacterId?: string | null;
  selectedByOtherPlayerIds: Set<string>;
  isLoading?: boolean;
  isError?: boolean;
  isSelecting?: boolean;
  onSelect: (characterId: string) => void;
}

export function CharacterSelectionPanel({
  characters,
  selectedCharacterId,
  selectedByOtherPlayerIds,
  isLoading = false,
  isError = false,
  isSelecting = false,
  onSelect,
}: CharacterSelectionPanelProps) {
  if (isLoading) {
    return (
      <Card className="p-4">
        <h2 className="text-base font-semibold text-[var(--mmp-color-ink)]">캐릭터 선택</h2>
        <p className="mt-2 text-sm text-[var(--mmp-color-steel)]">
          선택 가능한 캐릭터를 불러오는 중입니다.
        </p>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="p-4">
        <h2 className="text-base font-semibold text-[var(--mmp-color-ink)]">캐릭터 선택</h2>
        <p className="mt-2 text-sm text-[var(--mmp-color-error)]">
          캐릭터 목록을 불러올 수 없습니다.
        </p>
      </Card>
    );
  }

  if (characters.length === 0) {
    return (
      <Card className="p-4">
        <h2 className="text-base font-semibold text-[var(--mmp-color-ink)]">캐릭터 선택</h2>
        <p className="mt-2 text-sm text-[var(--mmp-color-steel)]">
          선택할 수 있는 캐릭터가 아직 없습니다.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--mmp-color-ink)]">캐릭터 선택</h2>
          <p className="mt-1 text-xs text-[var(--mmp-color-steel)]">
            게임을 시작하려면 각 참가자가 서로 다른 캐릭터를 선택해야 합니다.
          </p>
        </div>
        {selectedCharacterId && (
          <Badge variant="success" size="sm">
            <CheckCircle className="mr-1 h-3 w-3" />
            선택 완료
          </Badge>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {characters.map((character) => {
          const isSelected = character.id === selectedCharacterId;
          const isTakenByOther = selectedByOtherPlayerIds.has(character.id);
          const isDisabled = isSelecting || isSelected || isTakenByOther;

          return (
            <Button
              key={character.id}
              variant={isSelected ? 'primary' : 'secondary'}
              disabled={isDisabled}
              onClick={() => onSelect(character.id)}
              className="min-h-[104px] w-full items-stretch justify-start p-0 text-left"
            >
              <span className="flex w-full gap-3 p-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--mmp-color-muted)] text-[var(--mmp-color-charcoal)]">
                  {character.image_url ? (
                    <img src={character.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{character.name}</span>
                    {isSelected && (
                      <Badge variant="success" size="sm">
                        선택됨
                      </Badge>
                    )}
                    {isTakenByOther && (
                      <Badge variant="warning" size="sm">
                        <LockKeyhole className="mr-1 h-3 w-3" />
                        다른 참가자 선택
                      </Badge>
                    )}
                  </span>
                  <span className="line-clamp-2 text-xs font-normal opacity-80">
                    {character.description || '캐릭터 설명이 없습니다.'}
                  </span>
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </Card>
  );
}

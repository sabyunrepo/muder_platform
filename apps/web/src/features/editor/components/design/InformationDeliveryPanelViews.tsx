import { Plus, Trash2, Users } from "lucide-react";
import type { SceneEntryEffectViewModel } from "../../entities/shared/sceneEntryEffectAdapter";
import { OptionList, SearchField } from "./InformationDeliveryOptionList";

interface InformationDeliveryHeaderProps {
  canAddCharacterDelivery: boolean;
  onAddAllPlayers: () => void;
  onAddCharacter: () => void;
}

export function InformationDeliveryHeader({
  canAddCharacterDelivery,
  onAddAllPlayers,
  onAddCharacter,
}: InformationDeliveryHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h4 className="text-sm font-semibold text-slate-100">장면 진입 효과</h4>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          이 장면에 들어왔을 때 대상에게 공개할 정보와 지급할 단서를 연결합니다.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAddAllPlayers}
          className="inline-flex items-center justify-center gap-1 rounded border border-amber-500/40 px-2.5 py-1.5 text-xs text-amber-200 hover:bg-amber-500/10"
        >
          <Users className="h-3.5 w-3.5" />
          전체 대상 추가
        </button>
        <button
          type="button"
          onClick={onAddCharacter}
          disabled={!canAddCharacterDelivery}
          className={`inline-flex items-center justify-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium ${
            canAddCharacterDelivery
              ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
              : "cursor-not-allowed border border-slate-700 text-slate-400"
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
          캐릭터별 대상 추가
        </button>
      </div>
    </div>
  );
}

interface InformationDeliveryContentProps {
  loading: boolean;
  hasLoadError: boolean;
  hasCharacters: boolean;
  hasStoryInfos: boolean;
  hasClues: boolean;
  characterQuery: string;
  infoQuery: string;
  clueQuery: string;
  deliveries: SceneEntryEffectViewModel[];
  characters: { id: string; name: string }[];
  allCharacters: { id: string; name: string }[];
  storyInfos: StoryInfoOption[];
  allStoryInfos: StoryInfoOption[];
  clues: ClueOption[];
  allClues: ClueOption[];
  onRetryLoad: () => void;
  onCharacterQueryChange: (value: string) => void;
  onInfoQueryChange: (value: string) => void;
  onClueQueryChange: (value: string) => void;
  onSelectCharacter: (deliveryId: string, characterId: string) => void;
  onToggleStoryInfo: (delivery: SceneEntryEffectViewModel, storyInfoId: string) => void;
  onToggleClue: (delivery: SceneEntryEffectViewModel, clueId: string) => void;
  onRemoveDelivery: (deliveryId: string) => void;
}

export interface StoryInfoOption {
  id: string;
  name: string;
  summary?: string;
  metaLabel?: string;
}

export interface ClueOption {
  id: string;
  name: string;
  summary?: string;
  metaLabel?: string;
}

export function InformationDeliveryContent({
  loading,
  hasLoadError,
  hasCharacters,
  hasStoryInfos,
  hasClues,
  characterQuery,
  infoQuery,
  clueQuery,
  deliveries,
  characters,
  allCharacters,
  storyInfos,
  allStoryInfos,
  clues,
  allClues,
  onRetryLoad,
  onCharacterQueryChange,
  onInfoQueryChange,
  onClueQueryChange,
  onSelectCharacter,
  onToggleStoryInfo,
  onToggleClue,
  onRemoveDelivery,
}: InformationDeliveryContentProps) {
  if (loading) {
    return (
      <p className="mt-4 rounded border border-slate-800 bg-slate-900 px-3 py-3 text-xs text-slate-400">
        캐릭터, 정보, 단서 목록을 불러오는 중입니다.
      </p>
    );
  }

  if (hasLoadError) {
    return (
      <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs text-red-100">
        <p>장면 진입 효과에 필요한 캐릭터, 정보, 단서 목록을 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={onRetryLoad}
          className="mt-2 rounded border border-red-300/30 px-2 py-1 text-red-50 hover:bg-red-500/20"
        >
          다시 불러오기
        </button>
      </div>
    );
  }

  if (!hasStoryInfos && !hasClues) {
    return (
      <p className="mt-4 rounded border border-slate-800 bg-slate-900 px-3 py-3 text-xs leading-5 text-slate-400">
        연결할 정보나 단서가 없습니다. 먼저 정보 관리 또는 단서 관리에서 장면 효과로 쓸 항목을 만들어 주세요.
      </p>
    );
  }

  return (
    <>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <SearchField
          label="캐릭터 검색"
          value={characterQuery}
          onChange={onCharacterQueryChange}
          placeholder="이름으로 찾기"
        />
        <SearchField
          label="정보 검색"
          value={infoQuery}
          onChange={onInfoQueryChange}
          placeholder="정보 제목으로 찾기"
        />
        <SearchField
          label="단서 검색"
          value={clueQuery}
          onChange={onClueQueryChange}
          placeholder="단서 이름으로 찾기"
        />
      </div>

      {deliveries.length === 0 ? (
        <p className="mt-4 rounded border border-dashed border-slate-700 px-3 py-4 text-center text-xs leading-5 text-slate-400">
          {getEmptyDeliveryMessage(hasCharacters)}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {deliveries.map((delivery, index) => (
            <DeliveryCard
              key={delivery.id}
              index={index}
              delivery={delivery}
              characters={characters}
              allCharacters={allCharacters}
              storyInfos={storyInfos}
              allStoryInfos={allStoryInfos}
              clues={clues}
              allClues={allClues}
              onSelectCharacter={(characterId) => onSelectCharacter(delivery.id, characterId)}
              onToggleStoryInfo={(storyInfoId) => onToggleStoryInfo(delivery, storyInfoId)}
              onToggleClue={(clueId) => onToggleClue(delivery, clueId)}
              onRemove={() => onRemoveDelivery(delivery.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}


function getEmptyDeliveryMessage(hasCharacters: boolean): string {
  if (!hasCharacters) {
    return "아직 장면 진입 효과 대상이 없습니다. 전체 대상 추가를 눌러 모든 플레이어에게 적용할 효과를 연결해 주세요.";
  }
  return "아직 장면 진입 효과 대상이 없습니다. 전체 대상 추가 또는 캐릭터별 대상 추가를 눌러 대상을 정해 주세요.";
}

interface DeliveryCardProps {
  index: number;
  delivery: SceneEntryEffectViewModel;
  characters: { id: string; name: string }[];
  allCharacters: { id: string; name: string }[];
  storyInfos: StoryInfoOption[];
  allStoryInfos: StoryInfoOption[];
  clues: ClueOption[];
  allClues: ClueOption[];
  onSelectCharacter: (characterId: string) => void;
  onToggleStoryInfo: (storyInfoId: string) => void;
  onToggleClue: (clueId: string) => void;
  onRemove: () => void;
}

function DeliveryCard({
  index,
  delivery,
  characters,
  allCharacters,
  storyInfos,
  allStoryInfos,
  clues,
  allClues,
  onSelectCharacter,
  onToggleStoryInfo,
  onToggleClue,
  onRemove,
}: DeliveryCardProps) {
  const selectedCharacterName =
    delivery.recipientType === "all_players"
      ? "모든 플레이어"
      : allCharacters.find((character) => character.id === delivery.characterId)?.name;

  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-200">진입 효과 {index + 1}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            {selectedCharacterName ?? "받을 캐릭터를 선택하세요"} · 정보 {delivery.storyInfoIds.length}개 · 단서 {delivery.clueIds.length}개
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`진입 효과 ${index + 1} 삭제`}
          className="rounded p-1 text-slate-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid gap-3">
        {delivery.recipientType === "all_players" ? (
          <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            <Users className="h-4 w-4" />
            이 장면의 진입 효과가 모든 플레이어에게 적용됩니다.
          </div>
        ) : (
          <OptionList
            title="받을 캐릭터"
            emptyText="검색 결과가 없습니다."
            items={characters}
            selectedIds={delivery.characterId ? [delivery.characterId] : []}
            getMeta={() => undefined}
            onToggle={(id) => onSelectCharacter(id)}
            single
          />
        )}

        <OptionList
          title="정보 공개"
          emptyText="검색 결과가 없습니다."
          items={storyInfos}
          selectedIds={delivery.storyInfoIds}
          getMeta={(info) => info.metaLabel}
          onToggle={onToggleStoryInfo}
          allItems={allStoryInfos}
        />
        <OptionList
          title="단서 지급"
          emptyText="검색 결과가 없습니다."
          items={clues}
          selectedIds={delivery.clueIds}
          getMeta={(clue) => clue.metaLabel}
          onToggle={onToggleClue}
          allItems={allClues}
        />
      </div>
    </article>
  );
}

import { Plus, Search, Trash2, Users, UserRound } from "lucide-react";
import type { InformationDeliveryViewModel } from "../../entities/shared/informationDeliveryAdapter";
import type { ReadingSectionPickerOption } from "../../entities/story/readingSectionAdapter";

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
        <h4 className="text-sm font-semibold text-slate-100">읽기 대사 전달</h4>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          이 페이즈가 시작될 때 전체 또는 캐릭터별로 보여줄 읽기 대사를 선택합니다.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAddAllPlayers}
          className="inline-flex items-center justify-center gap-1 rounded border border-amber-500/40 px-2.5 py-1.5 text-xs text-amber-200 hover:bg-amber-500/10"
        >
          <Users className="h-3.5 w-3.5" />
          전체 전달
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
          캐릭터별 추가
        </button>
      </div>
    </div>
  );
}

interface InformationDeliveryContentProps {
  loading: boolean;
  hasLoadError: boolean;
  hasCharacters: boolean;
  hasSections: boolean;
  characterQuery: string;
  sectionQuery: string;
  deliveries: InformationDeliveryViewModel[];
  characters: { id: string; name: string }[];
  allCharacters: { id: string; name: string }[];
  sections: ReadingSectionPickerOption[];
  allSections: ReadingSectionPickerOption[];
  onRetryLoad: () => void;
  onCharacterQueryChange: (value: string) => void;
  onSectionQueryChange: (value: string) => void;
  onSelectCharacter: (deliveryId: string, characterId: string) => void;
  onToggleSection: (delivery: InformationDeliveryViewModel, sectionId: string) => void;
  onRemoveDelivery: (deliveryId: string) => void;
}

export function InformationDeliveryContent({
  loading,
  hasLoadError,
  hasCharacters,
  hasSections,
  characterQuery,
  sectionQuery,
  deliveries,
  characters,
  allCharacters,
  sections,
  allSections,
  onRetryLoad,
  onCharacterQueryChange,
  onSectionQueryChange,
  onSelectCharacter,
  onToggleSection,
  onRemoveDelivery,
}: InformationDeliveryContentProps) {
  if (loading) {
    return (
      <p className="mt-4 rounded border border-slate-800 bg-slate-900 px-3 py-3 text-xs text-slate-400">
        캐릭터와 읽기 대사를 불러오는 중입니다.
      </p>
    );
  }

  if (hasLoadError) {
    return (
      <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs text-red-100">
        <p>읽기 대사 전달에 필요한 캐릭터와 대사 목록을 불러오지 못했습니다.</p>
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

  if (!hasSections) {
    return (
      <p className="mt-4 rounded border border-slate-800 bg-slate-900 px-3 py-3 text-xs leading-5 text-slate-400">
        전달할 읽기 대사가 없습니다. 먼저 읽기 대사 탭에서 플레이어에게 보여줄 대사를 만들어 주세요.
      </p>
    );
  }

  return (
    <>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <SearchField
          label="캐릭터 검색"
          value={characterQuery}
          onChange={onCharacterQueryChange}
          placeholder="이름으로 찾기"
        />
        <SearchField
          label="읽기 대사 검색"
          value={sectionQuery}
          onChange={onSectionQueryChange}
          placeholder="대사 이름으로 찾기"
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
              sections={sections}
              allSections={allSections}
              onSelectCharacter={(characterId) => onSelectCharacter(delivery.id, characterId)}
              onToggleSection={(sectionId) => onToggleSection(delivery, sectionId)}
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
    return "아직 전달 설정이 없습니다. 전체 전달을 눌러 모든 플레이어에게 줄 공통 대사를 설정해 주세요.";
  }
  return "아직 전달 설정이 없습니다. 전체 전달 또는 캐릭터별 추가를 눌러 전달 대상을 정해 주세요.";
}

interface SearchFieldProps {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

function SearchField({ label, value, placeholder, onChange }: SearchFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-slate-400">
      {label}
      <span className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/40">
        <Search className="h-3.5 w-3.5 text-slate-400" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
        />
      </span>
    </label>
  );
}

interface DeliveryCardProps {
  index: number;
  delivery: InformationDeliveryViewModel;
  characters: { id: string; name: string }[];
  allCharacters: { id: string; name: string }[];
  sections: ReadingSectionPickerOption[];
  allSections: ReadingSectionPickerOption[];
  onSelectCharacter: (characterId: string) => void;
  onToggleSection: (sectionId: string) => void;
  onRemove: () => void;
}

function DeliveryCard({
  index,
  delivery,
  characters,
  allCharacters,
  sections,
  allSections,
  onSelectCharacter,
  onToggleSection,
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
          <p className="text-xs font-semibold text-slate-200">전달 설정 {index + 1}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            {selectedCharacterName ?? "받을 캐릭터를 선택하세요"} · {delivery.readingSectionIds.length}개 대사
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`전달 설정 ${index + 1} 삭제`}
          className="rounded p-1 text-slate-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid gap-3">
        {delivery.recipientType === "all_players" ? (
          <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            <Users className="h-4 w-4" />
            이 페이즈의 공통 읽기 대사로 모든 플레이어에게 전달됩니다.
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
          title="전달할 읽기 대사"
          emptyText="검색 결과가 없습니다."
          items={sections}
          selectedIds={delivery.readingSectionIds}
          getMeta={(section) => section.metaLabel}
          onToggle={onToggleSection}
          allItems={allSections}
        />
      </div>
    </article>
  );
}

interface OptionItem {
  id: string;
  name: string;
  summary?: string;
  groupLabel?: string;
}

interface OptionListProps<T extends OptionItem> {
  title: string;
  emptyText: string;
  items: T[];
  allItems?: T[];
  selectedIds: string[];
  single?: boolean;
  getMeta: (item: T) => string | undefined;
  onToggle: (id: string) => void;
}

function OptionList<T extends OptionItem>({
  title,
  emptyText,
  items,
  allItems,
  selectedIds,
  single = false,
  getMeta,
  onToggle,
}: OptionListProps<T>) {
  const selectedItems = (allItems ?? items).filter((item) => selectedIds.includes(item.id));

  return (
    <div className="rounded border border-slate-800 bg-slate-950/70 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-400">{title}</span>
        {selectedItems.length > 0 && (
          <span className="text-[10px] text-amber-300">{selectedItems.length}개 선택</span>
        )}
      </div>
      {selectedItems.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedItems.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] text-amber-100"
            >
              {single ? <UserRound className="h-3 w-3" /> : null}
              {item.name}
            </span>
          ))}
        </div>
      )}
      {items.length === 0 ? (
        <p className="px-2 py-3 text-center text-xs text-slate-400">{emptyText}</p>
      ) : (
        <div className="grid max-h-44 gap-1 overflow-y-auto pr-1">
          {items.map((item) => {
            const selected = selectedIds.includes(item.id);
            const meta = getMeta(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.id)}
                aria-pressed={selected}
                className={`flex min-h-10 items-center justify-between gap-2 rounded px-2 py-2 text-left text-xs transition-colors ${
                  selected
                    ? "bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/40"
                    : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.name}</span>
                  {item.summary && <span className="mt-0.5 block truncate text-[10px] text-slate-400">{item.summary}</span>}
                </span>
                {meta && <span className="shrink-0 text-[10px] text-slate-400">{meta}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

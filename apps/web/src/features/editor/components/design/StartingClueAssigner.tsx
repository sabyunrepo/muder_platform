import { useMemo } from 'react';
import { ClueSearchMultiSelect, type ClueSearchSelectItem } from './ClueSearchMultiSelect';

interface ClueItem {
  id: string;
  name: string;
  location?: string;
  round?: number;
  tag?: string;
}

interface StartingClueAssignerProps {
  characterName: string;
  clues: ClueItem[];
  selectedIds: string[];
  onClueToggle: (clueId: string, checked: boolean) => void;
  selectedTitle?: string;
}

function getClueMeta(clue: ClueItem) {
  return [clue.location, clue.tag].filter(Boolean).join(' · ');
}

function getRoundLabel(clue: ClueItem) {
  return typeof clue.round === 'number' ? `R${clue.round}` : 'CL';
}

function toClueSearchItem(clue: ClueItem): ClueSearchSelectItem {
  return {
    id: clue.id,
    name: clue.name,
    meta: getClueMeta(clue),
    badge: getRoundLabel(clue),
  };
}

export function StartingClueAssigner({
  characterName,
  clues,
  selectedIds,
  onClueToggle,
  selectedTitle,
}: StartingClueAssignerProps) {
  const items = useMemo(() => clues.map(toClueSearchItem), [clues]);

  if (clues.length === 0) {
    return <p className="text-xs text-slate-600">단서가 없습니다</p>;
  }

  return (
    <ClueSearchMultiSelect
      title={selectedTitle ?? `${characterName}의 시작 단서`}
      items={items}
      selectedIds={selectedIds}
      searchLabel="시작 단서 검색"
      searchPlaceholder="단서명, 장소, 태그 검색"
      emptySelectedText="아직 배정된 단서가 없습니다. 단서명으로 검색해 시작 단서를 추가하세요."
      idleSearchText="전체 단서를 펼치지 않고 검색 결과만 보여줍니다. 단서명이나 장소를 입력하세요."
      getAddAriaLabel={(item) => `${item.name} 시작 단서 추가`}
      getRemoveAriaLabel={(item) => `${item.name} 제거`}
      onAdd={(id) => onClueToggle(id, true)}
      onRemove={(id) => onClueToggle(id, false)}
    />
  );
}

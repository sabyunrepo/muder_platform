import type { ReadingSectionPickerOption } from "../../entities/story/readingSectionAdapter";
import { OptionList, SearchField } from "./InformationDeliveryOptionList";

interface ReadingSectionPickerProps {
  query: string;
  sections: ReadingSectionPickerOption[];
  allSections: ReadingSectionPickerOption[];
  selectedIds: string[];
  onQueryChange: (value: string) => void;
  onToggle: (sectionId: string) => void;
}

export function ReadingSectionPicker({
  query,
  sections,
  allSections,
  selectedIds,
  onQueryChange,
  onToggle,
}: ReadingSectionPickerProps) {
  return (
    <div className="grid gap-3">
      <SearchField
        label="읽기 대사 검색"
        value={query}
        onChange={onQueryChange}
        placeholder="대사 이름으로 찾기"
      />
      <OptionList
        title="읽기 대사 배치"
        emptyText="검색 결과가 없습니다."
        items={sections}
        selectedIds={selectedIds}
        getMeta={(section) => section.metaLabel}
        onToggle={onToggle}
        allItems={allSections}
      />
    </div>
  );
}

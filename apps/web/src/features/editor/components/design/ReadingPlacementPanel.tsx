import { useMemo, useState } from "react";
import { useReadingSections } from "../../readingApi";
import type { FlowNodeData } from "../../flowTypes";
import {
  filterReadingSectionOptions,
  toReadingSectionPickerOptions,
} from "../../entities/story/readingSectionAdapter";
import {
  flowNodeToReadingPlacement,
  readingPlacementToFlowNodePatch,
} from "../../entities/phase/readingPlacementAdapter";
import { ReadingSectionPicker } from "./ReadingSectionPicker";

interface ReadingPlacementPanelProps {
  themeId: string;
  phaseData: FlowNodeData;
  onChange: (patch: Partial<FlowNodeData>) => void;
}

export function ReadingPlacementPanel({
  themeId,
  phaseData,
  onChange,
}: ReadingPlacementPanelProps) {
  const {
    data: sections = [],
    isLoading,
    isError,
    refetch,
  } = useReadingSections(themeId);
  const [sectionQuery, setSectionQuery] = useState("");
  const placement = useMemo(() => flowNodeToReadingPlacement(phaseData), [phaseData]);
  const sectionOptions = useMemo(() => toReadingSectionPickerOptions(sections), [sections]);
  const filteredSections = useMemo(
    () => filterReadingSectionOptions(sectionOptions, sectionQuery),
    [sectionOptions, sectionQuery],
  );

  const toggleSection = (sectionId: string) => {
    const hasSection = placement.readingSectionIds.includes(sectionId);
    const nextIds = hasSection
      ? placement.readingSectionIds.filter((id) => id !== sectionId)
      : [...placement.readingSectionIds, sectionId];
    onChange(readingPlacementToFlowNodePatch(phaseData, nextIds));
  };

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <div>
        <h4 className="text-sm font-semibold text-slate-100">읽기 대사 배치</h4>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          스토리 진행 중 플레이어에게 순서대로 보여줄 읽기 대사를 연결합니다.
        </p>
      </div>

      {isLoading ? (
        <p className="mt-4 rounded border border-slate-800 bg-slate-900 px-3 py-3 text-xs text-slate-400">
          읽기 대사를 불러오는 중입니다.
        </p>
      ) : null}

      {isError ? (
        <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs text-red-100">
          <p>읽기 대사 목록을 불러오지 못했습니다.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 rounded border border-red-300/30 px-2 py-1 text-red-50 hover:bg-red-500/20"
          >
            다시 불러오기
          </button>
        </div>
      ) : null}

      {!isLoading && !isError && sections.length === 0 ? (
        <p className="mt-4 rounded border border-slate-800 bg-slate-900 px-3 py-3 text-xs leading-5 text-slate-400">
          배치할 읽기 대사가 없습니다. 먼저 읽기 대사 관리에서 대사를 만들어 주세요.
        </p>
      ) : null}

      {!isLoading && !isError && sections.length > 0 ? (
        <div className="mt-3">
          <ReadingSectionPicker
            query={sectionQuery}
            sections={filteredSections}
            allSections={sectionOptions}
            selectedIds={placement.readingSectionIds}
            onQueryChange={setSectionQuery}
            onToggle={toggleSection}
          />
        </div>
      ) : null}
    </section>
  );
}

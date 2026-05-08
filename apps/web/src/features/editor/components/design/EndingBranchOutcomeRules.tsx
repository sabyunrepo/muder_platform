import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { Node } from "@xyflow/react";
import type {
  EndingBranchConfig,
  EndingBranchMatrixRow,
  EndingBranchQuestion,
} from "../../entities/ending/endingBranchAdapter";
import { createEndingBranchMatrixRow, readChoiceCondition, updateMatrixCondition } from "../../entities/ending/endingBranchAdapter";
import type { FlowNodeData } from "../../flowTypes";

interface EndingBranchOutcomeRulesProps {
  draft: EndingBranchConfig;
  endingNodes: Node[];
  branchQuestions: EndingBranchQuestion[];
  canAddRule: boolean;
  onChange: (next: EndingBranchConfig) => void;
}

function endingName(node: Node): string {
  const data = node.data as FlowNodeData;
  return data.label?.trim() || "이름 없는 결말";
}

function reorderPriorities(config: EndingBranchConfig): EndingBranchConfig {
  return { ...config, matrix: config.matrix.map((row, index) => ({ ...row, priority: index + 1 })) };
}

export function EndingBranchOutcomeRules({
  draft,
  endingNodes,
  branchQuestions,
  canAddRule,
  onChange,
}: EndingBranchOutcomeRulesProps) {
  return (
    <div className="space-y-4">
      <DefaultEndingCard draft={draft} endingNodes={endingNodes} onChange={onChange} />
      <MatrixRulesCard
        draft={draft}
        endingNodes={endingNodes}
        branchQuestions={branchQuestions}
        canAddRule={canAddRule}
        onChange={onChange}
      />
    </div>
  );
}

interface DefaultEndingCardProps {
  draft: EndingBranchConfig;
  endingNodes: Node[];
  onChange: (next: EndingBranchConfig) => void;
}

function DefaultEndingCard({ draft, endingNodes, onChange }: DefaultEndingCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <h4 className="font-semibold text-slate-100">기본 결말</h4>
      <p className="mt-1 text-xs leading-5 text-slate-400">규칙에 맞는 결말이 없을 때 보여줄 결말입니다.</p>
      <select aria-label="기본 결말" value={draft.defaultEnding} onChange={(event) => onChange({ ...draft, defaultEnding: event.target.value })} className="mt-3 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
        <option value="">기본 결말 선택</option>
        {endingNodes.map((node) => <option key={node.id} value={node.id}>{endingName(node)}</option>)}
      </select>
      <label className="mt-3 block">
        <span className="text-xs font-medium text-slate-400">복수 선택 반영 기준</span>
        <div className="mt-1 flex items-center gap-2">
          <input type="number" min={1} max={100} value={Math.round((draft.multiVoteThreshold ?? 0.5) * 100)} onChange={(event) => onChange({ ...draft, multiVoteThreshold: Math.min(100, Math.max(1, Number(event.target.value))) / 100 })} className="min-h-11 w-24 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" />
          <span className="text-sm text-slate-400">% 이상 선택되면 반영</span>
        </div>
      </label>
    </div>
  );
}

type MatrixRulesCardProps = EndingBranchOutcomeRulesProps;

function MatrixRulesCard({ draft, endingNodes, branchQuestions, canAddRule, onChange }: MatrixRulesCardProps) {
  const [modalState, setModalState] = useState<{ mode: "create" | "edit"; rowIndex?: number } | null>(null);

  const handleSaveRule = (row: EndingBranchMatrixRow) => {
    if (modalState?.mode === "edit" && modalState.rowIndex !== undefined) {
      onChange(reorderPriorities({
        ...draft,
        matrix: draft.matrix.map((item, index) => (index === modalState.rowIndex ? row : item)),
      }));
    } else {
      onChange(reorderPriorities({ ...draft, matrix: [...draft.matrix, row] }));
    }
    setModalState(null);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-100">결말 규칙</h4>
          <p className="mt-1 text-xs leading-5 text-slate-400">위에서부터 먼저 맞는 규칙이 적용됩니다.</p>
        </div>
        <button type="button" onClick={() => setModalState({ mode: "create" })} disabled={!canAddRule} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 text-sm text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
          <Plus className="h-4 w-4" aria-hidden="true" /> 조건 만들기
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {draft.matrix.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">아직 규칙이 없습니다. 질문과 결말을 만든 뒤 규칙을 추가해 주세요.</p>
        ) : draft.matrix.map((row, rowIndex) => (
          <MatrixRuleRow
            key={row.priority}
            draft={draft}
            rowIndex={rowIndex}
            endingNodes={endingNodes}
            branchQuestions={branchQuestions}
            onChange={onChange}
            onEdit={() => setModalState({ mode: "edit", rowIndex })}
          />
        ))}
      </div>
      {modalState && (
        <EndingConditionModal
          draft={draft}
          endingNodes={endingNodes}
          branchQuestions={branchQuestions}
          initialRow={modalState.mode === "edit" && modalState.rowIndex !== undefined ? draft.matrix[modalState.rowIndex] : null}
          onClose={() => setModalState(null)}
          onSave={handleSaveRule}
        />
      )}
    </div>
  );
}

interface MatrixRuleRowProps {
  draft: EndingBranchConfig;
  rowIndex: number;
  endingNodes: Node[];
  branchQuestions: EndingBranchQuestion[];
  onChange: (next: EndingBranchConfig) => void;
  onEdit: () => void;
}

function MatrixRuleRow({ draft, rowIndex, endingNodes, branchQuestions, onChange, onEdit }: MatrixRuleRowProps) {
  const row = draft.matrix[rowIndex];
  const parsed = readChoiceCondition(row.condition);
  const selectedQuestion = parsed
    ? branchQuestions.find((question) => question.id === parsed.questionId)
    : undefined;
  const choiceText = parsed?.choices?.length
    ? parsed.choices.join(", ")
    : parsed?.choice;
  const aggregationText = parsed?.aggregation === "winning"
    ? " 이 가장 많이 선택되면 "
    : parsed?.aggregation === "all"
      ? " 이 모두 기준 이상 선택되면 "
      : parsed?.aggregation === "any"
        ? " 중 하나라도 기준 이상 선택되면 "
        : " 이 기준 이상 선택되면 ";
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-slate-100">규칙 {rowIndex + 1}</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onEdit} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">
            수정
          </button>
          <button type="button" onClick={() => onChange(reorderPriorities({ ...draft, matrix: draft.matrix.filter((_, index) => index !== rowIndex) }))} className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-200" aria-label={`규칙 ${rowIndex + 1} 삭제`}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="mt-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm leading-6 text-slate-300">
        <span className="font-semibold text-slate-100">{selectedQuestion?.text || "질문 선택 필요"}</span>
        {" 에서 "}
        <span className="font-semibold text-amber-100">{choiceText || "선택지 선택 필요"}</span>
        {aggregationText}
        <span className="font-semibold text-emerald-100">{endingName(endingNodes.find((node) => node.id === row.ending) ?? { id: "", type: "ending", position: { x: 0, y: 0 }, data: {} } as Node)}</span>
        {" 결말을 보여줍니다."}
      </p>
    </article>
  );
}

function EndingConditionModal({
  draft,
  endingNodes,
  branchQuestions,
  initialRow,
  onClose,
  onSave,
}: {
  draft: EndingBranchConfig;
  endingNodes: Node[];
  branchQuestions: EndingBranchQuestion[];
  initialRow: EndingBranchMatrixRow | null;
  onClose: () => void;
  onSave: (row: EndingBranchMatrixRow) => void;
}) {
  const parsed = initialRow ? readChoiceCondition(initialRow.condition) : null;
  const firstQuestion = branchQuestions[0];
  const [questionId, setQuestionId] = useState(parsed?.questionId ?? firstQuestion?.id ?? "");
  const selectedQuestion = branchQuestions.find((question) => question.id === questionId);
  const [selectedChoices, setSelectedChoices] = useState<string[]>(
    parsed?.choices?.length ? parsed.choices : selectedQuestion?.choices[0] ? [selectedQuestion.choices[0]] : [],
  );
  const [aggregation, setAggregation] = useState<"threshold" | "winning" | "all" | "any">(
    selectedQuestion?.type === "multi"
      ? parsed?.aggregation === "all" ? "all" : "any"
      : parsed?.aggregation === "winning" ? "winning" : "threshold",
  );
  const [endingId, setEndingId] = useState(initialRow?.ending ?? draft.defaultEnding ?? endingNodes[0]?.id ?? "");
  const isMultiQuestion = selectedQuestion?.type === "multi";

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" || event.key === "Esc") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const preview = useMemo(() => {
    const questionText = selectedQuestion?.text.trim() || "질문";
    const choiceText = selectedChoices.length > 0 ? selectedChoices.join(", ") : "선택지";
    const ending = endingName(endingNodes.find((node) => node.id === endingId) ?? { id: "", type: "ending", position: { x: 0, y: 0 }, data: {} } as Node);
    const ruleText = aggregation === "winning"
      ? "가장 많으면"
      : aggregation === "all"
        ? "모두 설정 비율 이상이면"
        : aggregation === "any"
          ? "하나라도 설정 비율 이상이면"
          : "설정 비율 이상이면";
    return `${questionText}에서 '${choiceText}' 답변이 ${ruleText} '${ending}' 결말로 보냅니다.`;
  }, [aggregation, endingId, endingNodes, selectedChoices, selectedQuestion]);

  const handleQuestionChange = (nextQuestionId: string) => {
    const nextQuestion = branchQuestions.find((question) => question.id === nextQuestionId);
    setQuestionId(nextQuestionId);
    setSelectedChoices(nextQuestion?.choices[0] ? [nextQuestion.choices[0]] : []);
    setAggregation(nextQuestion?.type === "multi" ? "any" : "threshold");
  };

  const toggleChoice = (choice: string) => {
    setSelectedChoices((current) => (
      current.includes(choice)
        ? current.filter((item) => item !== choice)
        : [...current, choice]
    ));
  };

  const handleSubmit = () => {
    if (!selectedQuestion || selectedChoices.length === 0 || !endingId) return;
    const base = initialRow ?? createEndingBranchMatrixRow(draft, endingId);
    onSave({
      ...updateMatrixCondition(
        base,
        selectedQuestion.id,
        isMultiQuestion ? selectedChoices : selectedChoices[0],
        isMultiQuestion ? aggregation === "all" ? "all" : "any" : aggregation,
      ),
      ending: endingId,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="조건 만들기">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-400">Condition</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-100">조건 만들기</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100" aria-label="조건 만들기 닫기">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-5 grid gap-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-400">질문</span>
            <select value={questionId} onChange={(event) => handleQuestionChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100">
              {branchQuestions.map((question) => <option key={question.id} value={question.id}>{question.text || "질문 내용 필요"}</option>)}
            </select>
          </label>
          {isMultiQuestion ? (
            <div>
              <span className="text-xs font-medium text-slate-400">답변</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {(selectedQuestion?.choices ?? []).map((item) => {
                  const selected = selectedChoices.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleChoice(item)}
                      className={`rounded-full border px-3 py-2 text-xs font-medium transition ${selected ? "border-amber-400 bg-amber-400/15 text-amber-100" : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"}`}
                      aria-pressed={selected}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <label className="block">
              <span className="text-xs font-medium text-slate-400">답변</span>
              <select value={selectedChoices[0] ?? ""} onChange={(event) => setSelectedChoices(event.target.value ? [event.target.value] : [])} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100">
                {(selectedQuestion?.choices ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-xs font-medium text-slate-400">집계 기준</span>
            <select value={aggregation} onChange={(event) => setAggregation(event.target.value === "winning" ? "winning" : event.target.value === "all" ? "all" : event.target.value === "any" ? "any" : "threshold")} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100">
              {isMultiQuestion ? (
                <>
                  <option value="any">하나라도 정답</option>
                  <option value="all">모두 정답</option>
                </>
              ) : (
                <>
                  <option value="threshold">과반수 / 설정 비율 이상</option>
                  <option value="winning">가장 많이 선택</option>
                </>
              )}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-400">보여줄 결말</span>
            <select value={endingId} onChange={(event) => setEndingId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100">
              {endingNodes.map((node) => <option key={node.id} value={node.id}>{endingName(node)}</option>)}
            </select>
          </label>
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm leading-6 text-emerald-100">{preview}</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-slate-700 px-4 text-sm text-slate-200 hover:bg-slate-800">취소</button>
          <button type="button" onClick={handleSubmit} disabled={!selectedQuestion || selectedChoices.length === 0 || !endingId} className="min-h-11 rounded-xl border border-amber-500/60 bg-amber-500/15 px-4 text-sm font-medium text-amber-100 hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50">조건 저장</button>
        </div>
      </section>
    </div>
  );
}

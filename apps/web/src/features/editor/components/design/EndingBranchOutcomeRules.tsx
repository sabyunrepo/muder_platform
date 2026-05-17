import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { Node } from "@xyflow/react";
import type { EditorCharacterResponse } from "@/features/editor/api";
import type {
  EndingBranchAggregation,
  EndingBranchConfig,
  EndingBranchMatrixRow,
  EndingBranchQuestion,
} from "../../entities/ending/endingBranchAdapter";
import {
  buildCharacterAliveCondition,
  buildChoiceCondition,
  buildConditionGroup,
  buildNegatedCondition,
  buildWinningChoiceCondition,
  createEndingBranchMatrixRow,
  groupEndingBranchRowsByEnding,
  readEndingConditionGroup,
} from "../../entities/ending/endingBranchAdapter";
import type { EditorConfig } from "../../utils/configShape";
import type { FlowNodeData } from "../../flowTypes";

interface EndingBranchOutcomeRulesProps {
  draft: EndingBranchConfig;
  endingNodes: Node[];
  branchQuestions: EndingBranchQuestion[];
  characters: EditorCharacterResponse[];
  canAddRule: boolean;
  selectedEndingId?: string;
  display?: "all" | "settings" | "rules";
  onChange: (next: EndingBranchConfig) => void;
}

type ConditionDraft =
  | {
      id: string;
      type: "question";
      questionId: string;
      choices: string[];
      aggregation: EndingBranchAggregation;
      negated: boolean;
    }
  | {
      id: string;
      type: "character_alive";
      characterId: string;
      alive: boolean;
      negated: boolean;
    };

function endingName(node: Node): string {
  const data = node.data as FlowNodeData;
  return data.label?.trim() || "이름 없는 결말";
}

function reorderPriorities(config: EndingBranchConfig): EndingBranchConfig {
  return { ...config, matrix: config.matrix.map((row, index) => ({ ...row, priority: index + 1 })) };
}

function conditionDraftId(index: number): string {
  return `condition-${Date.now()}-${index}`;
}

function firstQuestionDraft(branchQuestions: EndingBranchQuestion[]): ConditionDraft | null {
  const question = branchQuestions[0];
  if (!question) return null;
  return {
    id: conditionDraftId(0),
    type: "question",
    questionId: question.id,
    choices: question.choices[0] ? [question.choices[0]] : [],
    aggregation: question.type === "multi" ? "any" : "threshold",
    negated: false,
  };
}

function createCharacterDraft(characters: EditorCharacterResponse[]): ConditionDraft | null {
  const character = characters[0];
  if (!character) return null;
  return {
    id: conditionDraftId(0),
    type: "character_alive",
    characterId: character.id,
    alive: false,
    negated: false,
  };
}

function draftFromRow(
  row: EndingBranchMatrixRow | null,
  branchQuestions: EndingBranchQuestion[],
  characters: EditorCharacterResponse[],
): ConditionDraft[] {
  if (!row) {
    const question = firstQuestionDraft(branchQuestions);
    if (question) return [question];
    const character = createCharacterDraft(characters);
    return character ? [character] : [];
  }
  const group = readEndingConditionGroup(row.condition);
  const drafts = group.conditions.flatMap((condition, index): ConditionDraft[] => {
    if (condition.kind === "question_choice") {
      const question = branchQuestions.find((item) => item.id === condition.questionId);
      return [{
        id: conditionDraftId(index),
        type: "question",
        questionId: condition.questionId,
        choices: condition.choices.length > 0 ? condition.choices : condition.choice ? [condition.choice] : question?.choices[0] ? [question.choices[0]] : [],
        aggregation: condition.aggregation,
        negated: condition.negated,
      }];
    }
    if (condition.kind === "character_alive") {
      return [{
        id: conditionDraftId(index),
        type: "character_alive",
        characterId: condition.characterId,
        alive: condition.alive,
        negated: condition.negated,
      }];
    }
    return [];
  });
  if (drafts.length > 0) return drafts;
  const fallback = firstQuestionDraft(branchQuestions) ?? createCharacterDraft(characters);
  return fallback ? [fallback] : [];
}

function questionConditionToLogic(condition: Extract<ConditionDraft, { type: "question" }>): EditorConfig {
  const choices = Array.from(new Set(condition.choices.map((choice) => choice.trim()).filter(Boolean)));
  const firstChoice = choices[0] ?? "";
  const positiveCondition = condition.aggregation === "winning"
    ? buildWinningChoiceCondition(condition.questionId, firstChoice)
    : condition.aggregation === "all"
      ? buildConditionGroup(choices.map((choice) => buildChoiceCondition(condition.questionId, choice)))
      : condition.aggregation === "any"
        ? { or: choices.map((choice) => buildChoiceCondition(condition.questionId, choice)) }
        : buildChoiceCondition(condition.questionId, firstChoice);
  return condition.negated ? buildNegatedCondition(positiveCondition) : positiveCondition;
}

function conditionToLogic(condition: ConditionDraft): EditorConfig {
  if (condition.type === "question") return questionConditionToLogic(condition);
  const positiveCondition = buildCharacterAliveCondition(condition.characterId, condition.alive);
  return condition.negated ? buildNegatedCondition(positiveCondition) : positiveCondition;
}

function hasFinalConsonant(value: string): boolean {
  const last = value.trim().charCodeAt(value.trim().length - 1);
  if (!Number.isFinite(last)) return false;
  const base = last - 0xac00;
  return base >= 0 && base <= 11171 ? base % 28 !== 0 : false;
}

function subjectWithParticle(value: string): string {
  return `${value}${hasFinalConsonant(value) ? "이" : "가"}`;
}

function isConditionValid(condition: ConditionDraft, branchQuestions: EndingBranchQuestion[], characters: EditorCharacterResponse[]): boolean {
  if (condition.type === "question") {
    return Boolean(
      branchQuestions.find((question) => question.id === condition.questionId) &&
      condition.choices.some((choice) => choice.trim()),
    );
  }
  if (condition.type === "character_alive") {
    return characters.some((character) => character.id === condition.characterId);
  }
  return false;
}

function conditionPredicate(
  condition: ConditionDraft,
  branchQuestions: EndingBranchQuestion[],
  characters: EditorCharacterResponse[],
): string {
  if (condition.type === "question") {
    const question = branchQuestions.find((item) => item.id === condition.questionId);
    const choiceText = condition.choices.length > 0 ? condition.choices.join(", ") : "답변 선택 필요";
    const ruleText = condition.aggregation === "winning"
      ? condition.negated ? "가장 많이 선택되지 않은 상태" : "가장 많이 선택된 상태"
      : condition.aggregation === "all"
        ? condition.negated ? "모두 설정 비율 이상이 아닌 상태" : "모두 설정 비율 이상"
        : condition.aggregation === "any"
          ? condition.negated ? "하나도 설정 비율 이상이 아닌 상태" : "하나라도 설정 비율 이상"
          : condition.negated ? "설정 비율 미만" : "설정 비율 이상";
    return `${question?.text || "질문 선택 필요"}에서 '${choiceText}' 답변이 ${ruleText}`;
  }
  if (condition.type === "character_alive") {
    const character = characters.find((item) => item.id === condition.characterId);
    const subject = subjectWithParticle(character?.name || "캐릭터 선택 필요");
    if (condition.negated) {
      return `${subject} ${condition.alive ? "생존 중이 아닌 상태" : "사망하지 않은 상태"}`;
    }
    return `${subject} ${condition.alive ? "생존 중인 상태" : "사망한 상태"}`;
  }
  return "조건 선택 필요";
}

function conditionSummary(
  condition: ConditionDraft,
  branchQuestions: EndingBranchQuestion[],
  characters: EditorCharacterResponse[],
): string {
  return `${conditionPredicate(condition, branchQuestions, characters)}이면`;
}

function conditionFromAtom(condition: ReturnType<typeof readEndingConditionGroup>["conditions"][number], index: number): ConditionDraft {
  if (condition.kind === "question_choice") {
    return {
      id: `summary-${index}`,
      type: "question",
      questionId: condition.questionId,
      choices: condition.choices,
      aggregation: condition.aggregation,
      negated: condition.negated,
    };
  }
  if (condition.kind === "character_alive") {
    return {
      id: `summary-${index}`,
      type: "character_alive",
      characterId: condition.characterId,
      alive: condition.alive,
      negated: condition.negated,
    };
  }
  return { id: `summary-${index}`, type: "question", questionId: "", choices: [], aggregation: "threshold", negated: false };
}

function conditionGroupSentence(
  conditions: ConditionDraft[],
  branchQuestions: EndingBranchQuestion[],
  characters: EditorCharacterResponse[],
): string {
  if (conditions.length === 0) return "조건 설정이 필요합니다.";
  const predicates = conditions.map((condition) => conditionPredicate(condition, branchQuestions, characters));
  return predicates.length === 1 ? predicates[0] : predicates.join("이고, ");
}

export function EndingBranchOutcomeRules({
  draft,
  endingNodes,
  branchQuestions,
  characters,
  canAddRule,
  selectedEndingId,
  display = "all",
  onChange,
}: EndingBranchOutcomeRulesProps) {
  return (
    <div className="space-y-4">
      {display !== "rules" ? (
        <DefaultEndingCard draft={draft} endingNodes={endingNodes} onChange={onChange} />
      ) : null}
      {display !== "settings" ? (
        <MatrixRulesCard
          draft={draft}
          endingNodes={endingNodes}
          branchQuestions={branchQuestions}
          characters={characters}
          canAddRule={canAddRule}
          selectedEndingId={selectedEndingId}
          onChange={onChange}
        />
      ) : null}
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

function MatrixRulesCard({ draft, endingNodes, branchQuestions, characters, canAddRule, selectedEndingId, onChange }: MatrixRulesCardProps) {
  const [modalState, setModalState] = useState<{ mode: "create" | "edit"; endingId: string; rowIndex?: number } | null>(null);
  const groupedRows = useMemo(() => {
    const groups = groupEndingBranchRowsByEnding(draft, endingNodes);
    return selectedEndingId ? groups.filter((group) => group.endingId === selectedEndingId) : groups;
  }, [draft, endingNodes, selectedEndingId]);

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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-100">{selectedEndingId ? "조건 그룹" : "결말 규칙"}</h4>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {selectedEndingId
              ? "조건 그룹 중 하나라도 맞으면 이 결말이 적용됩니다."
              : "결말마다 조건 그룹을 만들고, 그룹 중 하나라도 맞으면 해당 결말이 적용됩니다."}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {groupedRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
            {selectedEndingId ? "선택한 결말을 찾을 수 없습니다." : "먼저 플레이어에게 보여줄 결말을 추가해 주세요."}
          </p>
        ) : groupedRows.map((group) => (
          <EndingRuleCard
            key={group.endingId}
            draft={draft}
            endingId={group.endingId}
            endingName={group.endingName}
            rows={group.rows}
            branchQuestions={branchQuestions}
            characters={characters}
            canAddRule={canAddRule}
            compact={Boolean(selectedEndingId)}
            onChange={onChange}
            onCreate={() => setModalState({ mode: "create", endingId: group.endingId })}
            onEdit={(rowIndex) => setModalState({ mode: "edit", endingId: group.endingId, rowIndex })}
          />
        ))}
      </div>
      {modalState && (
        <EndingConditionModal
          draft={draft}
          endingId={modalState.endingId}
          endingName={endingName(endingNodes.find((node) => node.id === modalState.endingId) ?? { id: "", type: "ending", position: { x: 0, y: 0 }, data: {} } as Node)}
          branchQuestions={branchQuestions}
          characters={characters}
          initialRow={modalState.mode === "edit" && modalState.rowIndex !== undefined ? draft.matrix[modalState.rowIndex] : null}
          onClose={() => setModalState(null)}
          onSave={handleSaveRule}
        />
      )}
    </div>
  );
}

interface EndingRuleCardProps {
  draft: EndingBranchConfig;
  endingId: string;
  endingName: string;
  rows: EndingBranchMatrixRow[];
  branchQuestions: EndingBranchQuestion[];
  characters: EditorCharacterResponse[];
  canAddRule: boolean;
  compact?: boolean;
  onChange: (next: EndingBranchConfig) => void;
  onCreate: () => void;
  onEdit: (rowIndex: number) => void;
}

function EndingRuleCard({ draft, endingId, endingName, rows, branchQuestions, characters, canAddRule, compact = false, onChange, onCreate, onEdit }: EndingRuleCardProps) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {compact ? null : <p className="font-semibold text-slate-100">{endingName}</p>}
          <p className="mt-1 text-xs text-slate-400">조건 그룹 {rows.length}개</p>
          {rows.length > 1 ? (
            <p className="mt-1 text-xs leading-5 text-amber-100">아래 조건 중 하나라도 만족하면 {endingName}을 보여줍니다.</p>
          ) : null}
        </div>
        <button type="button" onClick={onCreate} disabled={!canAddRule} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 text-sm text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
          <Plus className="h-4 w-4" aria-hidden="true" /> 조건 만들기
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-3 text-sm text-slate-400">이 결말로 가는 조건 그룹이 없습니다.</p>
        ) : rows.map((row, groupIndex) => {
          const rowIndex = draft.matrix.indexOf(row);
          return (
            <div key={`${row.priority}:${row.ending}`} className="space-y-2">
              {groupIndex > 0 ? (
                <div className="flex items-center gap-3" aria-hidden="true">
                  <div className="h-px flex-1 bg-slate-800" />
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">또는</span>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>
              ) : null}
              <ConditionGroupRow
                row={row}
                rowIndex={rowIndex}
                groupNumber={groupIndex + 1}
                branchQuestions={branchQuestions}
                characters={characters}
                onEdit={() => onEdit(rowIndex)}
                onRemove={() => onChange(reorderPriorities({ ...draft, matrix: draft.matrix.filter((_, index) => index !== rowIndex) }))}
              />
            </div>
          );
        })}
      </div>
      {endingId === draft.defaultEnding ? (
        <p className="mt-3 text-xs text-slate-500">조건이 맞지 않을 때도 기본 결말로 사용할 수 있습니다.</p>
      ) : null}
    </article>
  );
}

function ConditionGroupRow({
  row,
  rowIndex,
  groupNumber,
  branchQuestions,
  characters,
  onEdit,
  onRemove,
}: {
  row: EndingBranchMatrixRow;
  rowIndex: number;
  groupNumber: number;
  branchQuestions: EndingBranchQuestion[];
  characters: EditorCharacterResponse[];
  onEdit: () => void;
  onRemove: () => void;
}) {
  const group = readEndingConditionGroup(row.condition);
  const conditionDrafts = group.conditions.map((condition, index) => conditionFromAtom(condition, index));
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-slate-100">조건 그룹 {groupNumber}</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onEdit} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">
            수정
          </button>
          <button type="button" onClick={onRemove} className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-200" aria-label={`조건 그룹 ${groupNumber} 삭제`}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm leading-6 text-slate-200">
        {conditionGroupSentence(conditionDrafts, branchQuestions, characters)}
      </p>
      <ul className="sr-only">
        {group.conditions.length === 0 ? (
          <li>조건 설정 필요</li>
        ) : group.conditions.map((condition, index) => (
          <li key={index}>{conditionSummary(
            conditionFromAtom(condition, index),
            branchQuestions,
            characters,
          )}</li>
        ))}
      </ul>
    </article>
  );
}

function EndingConditionModal({
  draft,
  endingId,
  endingName,
  branchQuestions,
  characters,
  initialRow,
  onClose,
  onSave,
}: {
  draft: EndingBranchConfig;
  endingId: string;
  endingName: string;
  branchQuestions: EndingBranchQuestion[];
  characters: EditorCharacterResponse[];
  initialRow: EndingBranchMatrixRow | null;
  onClose: () => void;
  onSave: (row: EndingBranchMatrixRow) => void;
}) {
  const [conditions, setConditions] = useState<ConditionDraft[]>(() => draftFromRow(initialRow, branchQuestions, characters));

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" || event.key === "Esc") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const preview = useMemo(() => {
    const parts = conditions.map((condition) => conditionSummary(condition, branchQuestions, characters));
    return parts.length > 0
      ? `${parts.join(" 그리고 ")} '${endingName}' 결말로 보냅니다.`
      : `${endingName} 결말로 가는 조건을 추가해 주세요.`;
  }, [branchQuestions, characters, conditions, endingName]);

  const updateCondition = (conditionId: string, updater: (condition: ConditionDraft) => ConditionDraft) => {
    setConditions((current) => current.map((condition) => condition.id === conditionId ? updater(condition) : condition));
  };

  const addCondition = () => {
    const next = firstQuestionDraft(branchQuestions) ?? createCharacterDraft(characters);
    if (!next) return;
    setConditions((current) => [...current, { ...next, id: conditionDraftId(current.length) }]);
  };

  const handleSubmit = () => {
    if (!endingId || conditions.length === 0 || conditions.some((condition) => !isConditionValid(condition, branchQuestions, characters))) return;
    const base = initialRow ?? createEndingBranchMatrixRow(draft, endingId);
    onSave({
      ...base,
      ending: endingId,
      condition: buildConditionGroup(conditions.map((condition) => conditionToLogic(condition))),
    });
  };

  const canSave = Boolean(endingId) &&
    conditions.length > 0 &&
    conditions.every((condition) => isConditionValid(condition, branchQuestions, characters));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="조건 만들기">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-400">Condition</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-100">{endingName} 조건 만들기</h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">이 조건 그룹의 항목을 모두 만족하면 이 결말로 보냅니다. 다른 경로가 필요하면 같은 결말에 조건 그룹을 하나 더 추가하세요.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100" aria-label="조건 만들기 닫기">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-5 space-y-3">
          {conditions.map((condition, index) => (
            <ConditionEditorRow
              key={condition.id}
              condition={condition}
              index={index}
              branchQuestions={branchQuestions}
              characters={characters}
              onChange={(updater) => updateCondition(condition.id, updater)}
              onRemove={() => setConditions((current) => current.filter((item) => item.id !== condition.id))}
            />
          ))}
          <button type="button" onClick={addCondition} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 text-sm text-slate-100 hover:bg-slate-800">
            <Plus className="h-4 w-4" aria-hidden="true" /> 조건 추가
          </button>
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm leading-6 text-emerald-100">{preview}</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-slate-700 px-4 text-sm text-slate-200 hover:bg-slate-800">취소</button>
          <button type="button" onClick={handleSubmit} disabled={!canSave} className="min-h-11 rounded-xl border border-amber-500/60 bg-amber-500/15 px-4 text-sm font-medium text-amber-100 hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50">조건 저장</button>
        </div>
      </section>
    </div>
  );
}

function ConditionEditorRow({
  condition,
  index,
  branchQuestions,
  characters,
  onChange,
  onRemove,
}: {
  condition: ConditionDraft;
  index: number;
  branchQuestions: EndingBranchQuestion[];
  characters: EditorCharacterResponse[];
  onChange: (updater: (condition: ConditionDraft) => ConditionDraft) => void;
  onRemove: () => void;
}) {
  const selectedQuestion = condition.type === "question"
    ? branchQuestions.find((question) => question.id === condition.questionId)
    : undefined;
  const isMultiQuestion = selectedQuestion?.type === "multi";

  const changeType = (type: string) => {
    if (type === "character_alive") {
      const next = createCharacterDraft(characters);
      if (next) onChange(() => ({ ...next, id: condition.id }));
      return;
    }
    const next = firstQuestionDraft(branchQuestions);
    if (next) onChange(() => ({ ...next, id: condition.id }));
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-slate-100">조건 {index + 1}</p>
        <button type="button" onClick={onRemove} className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-200" aria-label={`조건 ${index + 1} 제거`}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3 grid gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-400">조건 종류</span>
          <select aria-label={index === 0 ? "조건 종류" : `조건 종류 ${index + 1}`} value={condition.type} onChange={(event) => changeType(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
            <option value="question">질문 답변</option>
            <option value="character_alive">캐릭터 상태</option>
          </select>
        </label>
        {condition.type === "question" ? (
          <>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">질문</span>
              <select aria-label={index === 0 ? "질문" : `질문 ${index + 1}`} value={condition.questionId} onChange={(event) => {
                const nextQuestion = branchQuestions.find((question) => question.id === event.target.value);
                onChange((current) => current.type === "question" ? {
                  ...current,
                  questionId: event.target.value,
                  choices: nextQuestion?.choices[0] ? [nextQuestion.choices[0]] : [],
                  aggregation: nextQuestion?.type === "multi" ? "any" : "threshold",
                } : current);
              }} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
                {branchQuestions.map((question) => <option key={question.id} value={question.id}>{question.text || "질문 내용 필요"}</option>)}
              </select>
            </label>
            {isMultiQuestion ? (
              <div>
                <span className="text-xs font-medium text-slate-400">답변</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(selectedQuestion?.choices ?? []).map((item) => {
                    const selected = condition.choices.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => onChange((current) => {
                          if (current.type !== "question") return current;
                          return {
                            ...current,
                            choices: selected
                              ? current.choices.filter((choice) => choice !== item)
                              : [...current.choices, item],
                          };
                        })}
                        className={`rounded-full border px-3 py-2 text-xs font-medium transition ${selected ? "border-amber-400 bg-amber-400/15 text-amber-100" : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"}`}
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
                <select aria-label={index === 0 ? "답변" : `답변 ${index + 1}`} value={condition.choices[0] ?? ""} onChange={(event) => onChange((current) => current.type === "question" ? { ...current, choices: event.target.value ? [event.target.value] : [] } : current)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
                  {(selectedQuestion?.choices ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            )}
            <label className="block">
              <span className="text-xs font-medium text-slate-400">집계 기준</span>
              <select aria-label={index === 0 ? "집계 기준" : `집계 기준 ${index + 1}`} value={condition.aggregation} onChange={(event) => onChange((current) => current.type === "question" ? { ...current, aggregation: event.target.value === "winning" ? "winning" : event.target.value === "all" ? "all" : event.target.value === "any" ? "any" : "threshold" } : current)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
                {isMultiQuestion ? (
                  <>
                    <option value="any">하나라도 설정 비율 이상</option>
                    <option value="all">모두 설정 비율 이상</option>
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
              <span className="text-xs font-medium text-slate-400">판정</span>
              <select aria-label={index === 0 ? "판정" : `판정 ${index + 1}`} value={condition.negated ? "not" : "is"} onChange={(event) => onChange((current) => current.type === "question" ? { ...current, negated: event.target.value === "not" } : current)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
                <option value="is">이면</option>
                <option value="not">아니면</option>
              </select>
            </label>
          </>
        ) : null}
        {condition.type === "character_alive" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-400">캐릭터</span>
              <select aria-label={index === 0 ? "캐릭터" : `캐릭터 ${index + 1}`} value={condition.characterId} onChange={(event) => onChange((current) => current.type === "character_alive" ? { ...current, characterId: event.target.value } : current)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
                {characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">상태</span>
              <select aria-label={index === 0 ? "상태" : `상태 ${index + 1}`} value={condition.alive ? "alive" : "dead"} onChange={(event) => onChange((current) => current.type === "character_alive" ? { ...current, alive: event.target.value === "alive" } : current)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
                <option value="dead">사망</option>
                <option value="alive">생존</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">판정</span>
              <select aria-label={index === 0 ? "판정" : `판정 ${index + 1}`} value={condition.negated ? "not" : "is"} onChange={(event) => onChange((current) => current.type === "character_alive" ? { ...current, negated: event.target.value === "not" } : current)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
                <option value="is">이면</option>
                <option value="not">아니면</option>
              </select>
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { EditorCharacterResponse } from "@/features/editor/api";
import { OptionList, type OptionItem } from "./InformationDeliveryOptionList";
import type { EndingBranchQuestion, EndingBranchQuestionTarget } from "../../entities/ending/endingBranchAdapter";

const ALL_PLAYERS_TARGET_ID = "__all_players__";

interface EndingBranchQuestionListProps {
  questions: EndingBranchQuestion[];
  characters: EditorCharacterResponse[];
  onAddQuestion: () => void;
  onRemoveQuestion: (questionId: string) => void;
  onChangeQuestion: (questionId: string, updater: (question: EndingBranchQuestion) => EndingBranchQuestion) => void;
  onChangeChoice: (questionId: string, choiceIndex: number, value: string) => void;
  onAddChoice: (questionId: string) => void;
  onRemoveChoice: (questionId: string, choice: string) => void;
}

export function EndingBranchQuestionList({
  questions,
  characters,
  onAddQuestion,
  onRemoveQuestion,
  onChangeQuestion,
  onChangeChoice,
  onAddChoice,
  onRemoveChoice,
}: EndingBranchQuestionListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(questions[0]?.id ?? null);
  const selectedQuestion = useMemo(
    () => questions.find((question) => question.id === selectedId) ?? questions[0] ?? null,
    [questions, selectedId],
  );

  useEffect(() => {
    if (!selectedQuestion) {
      setSelectedId(questions[0]?.id ?? null);
    }
  }, [questions, selectedQuestion]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-100">질문 관리</h4>
          <p className="mt-1 text-xs leading-5 text-slate-400">공통 질문 풀을 만들고, 결말 규칙에 사용할 질문만 표시합니다.</p>
        </div>
        <button type="button" onClick={onAddQuestion} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 text-sm text-slate-100 hover:bg-slate-800">
          <Plus className="h-4 w-4" aria-hidden="true" /> 질문 추가
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(220px,320px)_minmax(0,1fr)]">
        {questions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400 lg:col-span-2">아직 질문이 없습니다. 결말을 가를 질문을 추가해 주세요.</p>
        ) : (
          <>
            <div className="space-y-2">
              {questions.map((question, questionIndex) => (
                <QuestionSummaryButton
                  key={question.id}
                  question={question}
                  questionIndex={questionIndex}
                  selected={selectedQuestion?.id === question.id}
                  characters={characters}
                  onSelect={() => setSelectedId(question.id)}
                />
              ))}
            </div>
            {selectedQuestion && (
              <QuestionDetail
                question={selectedQuestion}
                questionIndex={questions.findIndex((question) => question.id === selectedQuestion.id)}
                characters={characters}
                onRemoveQuestion={onRemoveQuestion}
                onChangeQuestion={onChangeQuestion}
                onChangeChoice={onChangeChoice}
                onAddChoice={onAddChoice}
                onRemoveChoice={onRemoveChoice}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function hasScores(question: EndingBranchQuestion): boolean {
  return Object.values(question.scoreMap ?? {}).some((score) => score !== 0);
}

function targetSummary(question: EndingBranchQuestion, characters: EditorCharacterResponse[]): string {
  if (question.target.type === "all_players") return "모든 플레이어";
  const names = question.target.characterIds.map((id) => characters.find((character) => character.id === id)?.name?.trim() || "삭제된 캐릭터");
  return names.length > 0 ? names.join(", ") : "대상 필요";
}

function QuestionSummaryButton({
  question,
  questionIndex,
  selected,
  characters,
  onSelect,
}: {
  question: EndingBranchQuestion;
  questionIndex: number;
  selected: boolean;
  characters: EditorCharacterResponse[];
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-amber-400/60 ${
        selected ? "border-amber-500/70 bg-amber-500/10" : "border-slate-800 bg-slate-900/70 hover:border-slate-600"
      }`}
    >
      <p className="text-xs font-semibold text-slate-400">Q{questionIndex + 1}</p>
      <p className="mt-1 line-clamp-2 font-medium text-slate-100">{question.text || "질문 내용 필요"}</p>
      <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">{question.type === "multi" ? "복수 선택" : "하나 선택"}</span>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">{targetSummary(question, characters)}</span>
        {question.impact === "branch" && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-100">결말 규칙에서 사용</span>}
        {hasScores(question) && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-100">점수 있음</span>}
      </div>
    </button>
  );
}

function QuestionDetail({
  question,
  questionIndex,
  characters,
  onRemoveQuestion,
  onChangeQuestion,
  onChangeChoice,
  onAddChoice,
  onRemoveChoice,
}: {
  question: EndingBranchQuestion;
  questionIndex: number;
  characters: EditorCharacterResponse[];
  onRemoveQuestion: (questionId: string) => void;
  onChangeQuestion: (questionId: string, updater: (question: EndingBranchQuestion) => EndingBranchQuestion) => void;
  onChangeChoice: (questionId: string, choiceIndex: number, value: string) => void;
  onAddChoice: (questionId: string) => void;
  onRemoveChoice: (questionId: string, choice: string) => void;
}) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-400">질문 {questionIndex + 1}</p>
          <h5 className="mt-1 font-semibold text-slate-100">{question.text || "질문 내용 필요"}</h5>
        </div>
        <button type="button" onClick={() => onRemoveQuestion(question.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-200" aria-label={`질문 ${questionIndex + 1} 삭제`}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-medium text-slate-400">질문 내용</span>
        <input
          value={question.text}
          aria-label={`질문 ${questionIndex + 1} 내용`}
          onChange={(event) => onChangeQuestion(question.id, (item) => ({ ...item, text: event.target.value }))}
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-400">답변 방식</span>
          <select value={question.type} onChange={(event) => onChangeQuestion(question.id, (item) => ({ ...item, type: event.target.value === "multi" ? "multi" : "single" }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
            <option value="single">하나 선택</option>
            <option value="multi">복수 선택</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 self-end rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
          <input
            type="checkbox"
            checked={question.impact === "branch"}
            onChange={(event) => onChangeQuestion(question.id, (item) => ({ ...item, impact: event.target.checked ? "branch" : "score" }))}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-500"
          />
          결말 규칙에서 사용
        </label>
      </div>

      <QuestionTargetSelector
        question={question}
        questionIndex={questionIndex}
        characters={characters}
        onChangeQuestion={onChangeQuestion}
      />

      <ChoiceRows
        question={question}
        questionIndex={questionIndex}
        onChangeChoice={onChangeChoice}
        onAddChoice={onAddChoice}
        onRemoveChoice={onRemoveChoice}
        onChangeQuestion={onChangeQuestion}
      />
    </article>
  );
}

interface TargetOption extends OptionItem {
  roleLabel?: string;
}

interface QuestionTargetSelectorProps {
  question: EndingBranchQuestion;
  questionIndex: number;
  characters: EditorCharacterResponse[];
  onChangeQuestion: (questionId: string, updater: (question: EndingBranchQuestion) => EndingBranchQuestion) => void;
}

function characterSummary(character: EditorCharacterResponse): string | undefined {
  if (!character.is_playable) return "비플레이어";
  if (character.mystery_role === "detective") return "탐정";
  if (character.mystery_role === "culprit") return "범인";
  if (character.mystery_role === "accomplice") return "공범";
  return "플레이어 캐릭터";
}

function targetToSelectedIds(target: EndingBranchQuestionTarget): string[] {
  return target.type === "specific_players" ? target.characterIds : [ALL_PLAYERS_TARGET_ID];
}

function targetFromToggle(target: EndingBranchQuestionTarget, id: string): EndingBranchQuestionTarget {
  if (id === ALL_PLAYERS_TARGET_ID) return { type: "all_players" };
  const currentIds = target.type === "specific_players" ? target.characterIds : [];
  const nextIds = currentIds.includes(id)
    ? currentIds.filter((characterId) => characterId !== id)
    : [...currentIds, id];
  return { type: "specific_players", characterIds: nextIds };
}

function legacyRespondents(target: EndingBranchQuestionTarget): "all" | string {
  return target.type === "specific_players" ? target.characterIds[0] ?? "" : "all";
}

function QuestionTargetSelector({
  question,
  questionIndex,
  characters,
  onChangeQuestion,
}: QuestionTargetSelectorProps) {
  const characterOptions: TargetOption[] = characters.map((character) => ({
    id: character.id,
    name: character.name.trim() || "이름 없는 캐릭터",
    summary: character.description?.trim() || characterSummary(character),
  }));
  const knownIds = new Set(characterOptions.map((item) => item.id));
  const deletedOptions: TargetOption[] = question.target.type === "specific_players"
    ? question.target.characterIds
      .filter((id) => !knownIds.has(id))
      .map((id) => ({ id, name: "삭제된 캐릭터", summary: id }))
    : [];
  const allPlayerOption: TargetOption = {
    id: ALL_PLAYERS_TARGET_ID,
    name: "모든 플레이어",
    summary: "공통 종료 질문",
  };
  const items = [allPlayerOption, ...characterOptions];
  const allItems = [...items, ...deletedOptions];
  const selectedIds = targetToSelectedIds(question.target);

  return (
    <div className="mt-3">
      <OptionList
        title="받을 대상"
        emptyText="선택 가능한 캐릭터가 없습니다."
        items={items}
        allItems={allItems}
        selectedIds={selectedIds}
        getMeta={(item) => item.id === ALL_PLAYERS_TARGET_ID ? "공통 종료 질문" : item.summary}
        onToggle={(id) => onChangeQuestion(question.id, (item) => {
          const target = targetFromToggle(item.target, id);
          return { ...item, target, respondents: legacyRespondents(target) };
        })}
      />
      {question.target.type === "specific_players" && question.target.characterIds.length === 0 && (
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          질문 {questionIndex + 1}을 받을 캐릭터를 1명 이상 선택해 주세요.
        </p>
      )}
    </div>
  );
}

interface ChoiceRowsProps {
  question: EndingBranchQuestion;
  questionIndex: number;
  onChangeChoice: (questionId: string, choiceIndex: number, value: string) => void;
  onAddChoice: (questionId: string) => void;
  onRemoveChoice: (questionId: string, choice: string) => void;
  onChangeQuestion: (questionId: string, updater: (question: EndingBranchQuestion) => EndingBranchQuestion) => void;
}

function ChoiceRows({ question, questionIndex, onChangeChoice, onAddChoice, onRemoveChoice, onChangeQuestion }: ChoiceRowsProps) {
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-400">선택지 및 점수</span>
        <button type="button" onClick={() => onAddChoice(question.id)} className="text-xs font-medium text-amber-300 hover:text-amber-200">선택지 추가</button>
      </div>
      {question.choices.map((choice, choiceIndex) => (
        <div key={`${question.id}-${choiceIndex}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_96px_40px]">
          <input value={choice} aria-label={`질문 ${questionIndex + 1} 선택지 ${choiceIndex + 1}`} onChange={(event) => onChangeChoice(question.id, choiceIndex, event.target.value)} className="min-h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" />
          <input type="number" aria-label={`선택지 ${choiceIndex + 1} 점수`} value={question.scoreMap?.[choice] ?? 0} onChange={(event) => onChangeQuestion(question.id, (item) => ({ ...item, scoreMap: { ...(item.scoreMap ?? {}), [choice]: Number(event.target.value) } }))} className="min-h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" />
          <button type="button" onClick={() => onRemoveChoice(question.id, choice)} className="min-h-10 rounded-xl border border-slate-800 text-slate-400 hover:border-rose-400/40 hover:text-rose-200" aria-label={`선택지 ${choiceIndex + 1} 삭제`}>×</button>
        </div>
      ))}
    </div>
  );
}

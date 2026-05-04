import { Plus, Trash2 } from "lucide-react";
import type { EndingBranchQuestion } from "../../entities/ending/endingBranchAdapter";

interface EndingBranchQuestionListProps {
  questions: EndingBranchQuestion[];
  onAddQuestion: () => void;
  onRemoveQuestion: (questionId: string) => void;
  onChangeQuestion: (questionId: string, updater: (question: EndingBranchQuestion) => EndingBranchQuestion) => void;
  onChangeChoice: (questionId: string, choiceIndex: number, value: string) => void;
  onAddChoice: (questionId: string) => void;
  onRemoveChoice: (questionId: string, choice: string) => void;
}

export function EndingBranchQuestionList({
  questions,
  onAddQuestion,
  onRemoveQuestion,
  onChangeQuestion,
  onChangeChoice,
  onAddChoice,
  onRemoveChoice,
}: EndingBranchQuestionListProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-100">결말 질문</h4>
          <p className="mt-1 text-xs leading-5 text-slate-400">플레이어에게 물어볼 질문과 선택지를 만듭니다.</p>
        </div>
        <button type="button" onClick={onAddQuestion} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 text-sm text-slate-100 hover:bg-slate-800">
          <Plus className="h-4 w-4" aria-hidden="true" /> 질문 추가
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {questions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">아직 질문이 없습니다. 결말을 가를 질문을 추가해 주세요.</p>
        ) : questions.map((question, questionIndex) => (
          <article key={question.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-semibold text-slate-400">질문 {questionIndex + 1}</p>
              <button type="button" onClick={() => onRemoveQuestion(question.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-200" aria-label={`질문 ${questionIndex + 1} 삭제`}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <label className="mt-2 block">
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
              <label className="block">
                <span className="text-xs font-medium text-slate-400">판정 방식</span>
                <select value={question.impact} onChange={(event) => onChangeQuestion(question.id, (item) => ({ ...item, impact: event.target.value === "score" ? "score" : "branch" }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
                  <option value="branch">선택지별 결말 분기</option>
                  <option value="score">선택지 점수 계산</option>
                </select>
              </label>
            </div>

            <ChoiceRows
              question={question}
              questionIndex={questionIndex}
              onChangeChoice={onChangeChoice}
              onAddChoice={onAddChoice}
              onRemoveChoice={onRemoveChoice}
              onChangeQuestion={onChangeQuestion}
            />
          </article>
        ))}
      </div>
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
        <span className="text-xs font-medium text-slate-400">선택지</span>
        <button type="button" onClick={() => onAddChoice(question.id)} className="text-xs font-medium text-amber-300 hover:text-amber-200">선택지 추가</button>
      </div>
      {question.choices.map((choice, choiceIndex) => (
        <div key={`${question.id}-${choiceIndex}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_96px_40px]">
          <input value={choice} aria-label={`질문 ${questionIndex + 1} 선택지 ${choiceIndex + 1}`} onChange={(event) => onChangeChoice(question.id, choiceIndex, event.target.value)} className="min-h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" />
          {question.impact === "score" ? (
            <input type="number" aria-label={`선택지 ${choiceIndex + 1} 점수`} value={question.scoreMap?.[choice] ?? 0} onChange={(event) => onChangeQuestion(question.id, (item) => ({ ...item, scoreMap: { ...(item.scoreMap ?? {}), [choice]: Number(event.target.value) } }))} className="min-h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" />
          ) : <span className="hidden sm:block" />}
          <button type="button" onClick={() => onRemoveChoice(question.id, choice)} className="min-h-10 rounded-xl border border-slate-800 text-slate-400 hover:border-rose-400/40 hover:text-rose-200" aria-label={`선택지 ${choiceIndex + 1} 삭제`}>×</button>
        </div>
      ))}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Save } from "lucide-react";
import { toast } from "sonner";
import type { Node } from "@xyflow/react";
import type { EditorThemeResponse } from "@/features/editor/api";
import { useUpdateConfigJson } from "@/features/editor/editorConfigApi";
import {
  createEndingBranchMatrixRow,
  createEndingBranchQuestion,
  readChoiceCondition,
  readEndingBranchConfig,
  toEndingBranchEditorViewModel,
  writeEndingBranchConfig,
  type EndingBranchConfig,
  type EndingBranchQuestion,
} from "../../entities/ending/endingBranchAdapter";
import { EndingBranchOutcomeRules } from "./EndingBranchOutcomeRules";
import { EndingBranchQuestionList } from "./EndingBranchQuestionList";

interface EndingBranchRulesPanelProps {
  themeId: string;
  theme: EditorThemeResponse;
  endingNodes: Node[];
}

function reorderPriorities(config: EndingBranchConfig): EndingBranchConfig {
  return { ...config, matrix: config.matrix.map((row, index) => ({ ...row, priority: index + 1 })) };
}

function updateQuestionAt(
  config: EndingBranchConfig,
  questionId: string,
  updater: (question: EndingBranchQuestion) => EndingBranchQuestion,
): EndingBranchConfig {
  return {
    ...config,
    questions: config.questions.map((question) =>
      question.id === questionId ? updater(question) : question,
    ),
  };
}

export function EndingBranchRulesPanel({ themeId, theme, endingNodes }: EndingBranchRulesPanelProps) {
  const updateConfig = useUpdateConfigJson(themeId);
  const serverConfig = useMemo(() => readEndingBranchConfig(theme.config_json), [theme.config_json]);
  const [draft, setDraft] = useState<EndingBranchConfig>(serverConfig);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(serverConfig);
    setDirty(false);
  }, [serverConfig]);

  const viewModel = useMemo(
    () => toEndingBranchEditorViewModel(writeEndingBranchConfig(theme.config_json, draft), endingNodes),
    [draft, endingNodes, theme.config_json],
  );
  const branchQuestions = draft.questions.filter((question) => question.impact === "branch");
  const canAddRule = endingNodes.length > 0 && branchQuestions.some((question) => question.choices.length > 0);

  const applyDraft = (next: EndingBranchConfig) => {
    setDraft(next);
    setDirty(true);
  };

  const handleSave = () => {
    updateConfig.mutate(
      { ...writeEndingBranchConfig(theme.config_json, draft), version: theme.version },
      {
        onSuccess: () => {
          setDirty(false);
          toast.success("결말 판정 설정이 저장되었습니다");
        },
        onError: () => toast.error("결말 판정 설정 저장에 실패했습니다"),
      },
    );
  };

  const handleRemoveQuestion = (questionId: string) => {
    applyDraft(reorderPriorities({
      ...draft,
      questions: draft.questions.filter((question) => question.id !== questionId),
      matrix: draft.matrix.filter((row) => readChoiceCondition(row.condition)?.questionId !== questionId),
    }));
  };

  const handleChoiceChange = (questionId: string, choiceIndex: number, value: string) => {
    applyDraft(updateQuestionAt(draft, questionId, (question) => ({
      ...question,
      choices: question.choices.map((choice, index) => (index === choiceIndex ? value : choice)),
      scoreMap: question.scoreMap
        ? Object.fromEntries(question.choices.map((choice, index) => [index === choiceIndex ? value : choice, question.scoreMap?.[choice] ?? 0]))
        : undefined,
    })));
  };

  const handleRemoveChoice = (questionId: string, choice: string) => {
    applyDraft(reorderPriorities({
      ...updateQuestionAt(draft, questionId, (question) => ({
        ...question,
        choices: question.choices.filter((item) => item !== choice),
        scoreMap: question.scoreMap
          ? Object.fromEntries(Object.entries(question.scoreMap).filter(([key]) => key !== choice))
          : undefined,
      })),
      matrix: draft.matrix.filter((row) => {
        const parsed = readChoiceCondition(row.condition);
        return !(parsed?.questionId === questionId && parsed.choice === choice);
      }),
    }));
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300" aria-label="결말 판정 설정">
      <Header dirty={dirty} isPending={updateConfig.isPending} onSave={handleSave} />
      <Warnings warnings={viewModel.warnings} />
      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <EndingBranchQuestionList
          questions={draft.questions}
          onAddQuestion={() => applyDraft({ ...draft, questions: [...draft.questions, createEndingBranchQuestion(draft.questions.length)] })}
          onRemoveQuestion={handleRemoveQuestion}
          onChangeQuestion={(questionId, updater) => applyDraft(updateQuestionAt(draft, questionId, updater))}
          onChangeChoice={handleChoiceChange}
          onAddChoice={(questionId) => applyDraft(updateQuestionAt(draft, questionId, (question) => ({ ...question, choices: [...question.choices, `선택지 ${question.choices.length + 1}`] })))}
          onRemoveChoice={handleRemoveChoice}
        />
        <EndingBranchOutcomeRules
          draft={draft}
          endingNodes={endingNodes}
          branchQuestions={branchQuestions}
          canAddRule={canAddRule}
          onChange={applyDraft}
          onAddRule={() => applyDraft(reorderPriorities({ ...draft, matrix: [...draft.matrix, createEndingBranchMatrixRow(draft, draft.defaultEnding || endingNodes[0]?.id || "")] }))}
        />
      </div>
    </section>
  );
}

function Header({ dirty, isPending, onSave }: { dirty: boolean; isPending: boolean; onSave: () => void }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-400">Ending Rules</p>
        <h3 className="mt-1 text-lg font-semibold text-slate-100">결말 판정 설정</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">최종 투표나 질문 답변이 어떤 결말로 이어지는지 설정합니다. 내부 판정식은 자동으로 만들어집니다.</p>
      </div>
      <button type="button" onClick={onSave} disabled={!dirty || isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 text-sm font-medium text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50">
        <Save className="h-4 w-4" aria-hidden="true" />
        {isPending ? "저장 중" : dirty ? "판정 설정 저장" : "저장됨"}
      </button>
    </div>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-100">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        결말 질문, 기본 결말, 판정 규칙이 준비되어 있습니다.
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-100">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-medium">저장 전 확인할 점</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-5">
            {warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

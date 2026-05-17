import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Node } from "@xyflow/react";
import type { EditorCharacterResponse, EditorThemeResponse } from "@/features/editor/api";
import { useUpdateConfigJson } from "@/features/editor/editorConfigApi";
import { useDebouncedMutation } from "@/hooks/useDebouncedMutation";
import {
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
  characters: EditorCharacterResponse[];
  section: "questions" | "endings";
  selectedEndingId?: string;
  embedded?: boolean;
  settingsOnly?: boolean;
}

interface AutosaveBody {
  draft: EndingBranchConfig;
}

const ENDING_BRANCH_AUTOSAVE_MS = 1500;

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

function hasDuplicateChoice(
  question: EndingBranchQuestion,
  choiceIndex: number,
  value: string,
): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  return question.choices.some((choice, index) => index !== choiceIndex && choice.trim() === normalized);
}

function createUniqueChoiceLabel(question: EndingBranchQuestion): string {
  const existing = new Set(question.choices.map((choice) => choice.trim()));
  let index = question.choices.length + 1;
  let label = `선택지 ${index}`;
  while (existing.has(label)) {
    index += 1;
    label = `선택지 ${index}`;
  }
  return label;
}

function updateChoiceValues(
  question: EndingBranchQuestion,
  choiceIndex: number,
  value: string,
): string[] {
  if (hasDuplicateChoice(question, choiceIndex, value)) return question.choices;
  return question.choices.map((choice, index) => (index === choiceIndex ? value : choice));
}

function hasInvalidSpecificPlayerTarget(config: EndingBranchConfig): boolean {
  return config.questions.some(
    (question) => question.target.type === "specific_players" && question.target.characterIds.length === 0,
  );
}

function endingBranchConfigEqual(left: EndingBranchConfig, right: EndingBranchConfig): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function EndingBranchRulesPanel({ themeId, theme, endingNodes, characters, section, selectedEndingId, embedded = false, settingsOnly = false }: EndingBranchRulesPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const updateConfig = useUpdateConfigJson(themeId);
  const serverConfig = useMemo(() => readEndingBranchConfig(theme.config_json), [theme.config_json]);
  const [draft, setDraft] = useState<EndingBranchConfig>(serverConfig);
  const [dirty, setDirty] = useState(false);
  const draftRef = useRef(draft);
  const isQuestions = section === "questions";
  const toastId = isQuestions ? "ending-questions-autosave" : "ending-rules-autosave";
  const loadingMessage = isQuestions ? "질문 설정 자동저장 중..." : "결말 판정 규칙 자동저장 중...";
  const successMessage = isQuestions ? "질문 설정이 자동저장되었습니다" : "결말 판정 규칙이 자동저장되었습니다";
  const failureMessage = isQuestions ? "질문 설정 자동저장에 실패했습니다" : "결말 판정 규칙 자동저장에 실패했습니다";

  useEffect(() => {
    if (dirty) return;
    setDraft(serverConfig);
    setDirty(false);
  }, [dirty, serverConfig]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const viewModel = useMemo(
    () => toEndingBranchEditorViewModel(writeEndingBranchConfig(theme.config_json, draft), endingNodes),
    [draft, endingNodes, theme.config_json],
  );
  const branchQuestions = draft.questions.filter((question) => question.impact === "branch");
  const canAddRule = endingNodes.length > 0 && (
    branchQuestions.some((question) => question.choices.length > 0) ||
    characters.length > 0
  );

  const saveBody = useCallback((body: AutosaveBody, opts?: { onError?: (error?: unknown) => void }) => {
    const submittedDraft = body.draft;
    toast.loading(loadingMessage, { id: toastId });
    updateConfig.mutate(
      { ...writeEndingBranchConfig(theme.config_json, submittedDraft), version: theme.version },
      {
        onSuccess: () => {
          if (draftRef.current === submittedDraft) {
            setDirty(false);
          }
          toast.success(successMessage, { id: toastId, duration: 1200 });
        },
        onError: opts?.onError,
      },
    );
  }, [loadingMessage, successMessage, theme.config_json, theme.version, toastId, updateConfig]);

  const showFailureToast = useCallback((body: AutosaveBody) => {
    toast.error(failureMessage, {
      id: toastId,
      duration: 6000,
      action: {
        label: "재시도",
        onClick: () => saveBody(body, { onError: () => showFailureToast(body) }),
      },
    });
  }, [failureMessage, saveBody, toastId]);

  const { schedule, flush, cancel } = useDebouncedMutation<AutosaveBody>({
    debounceMs: ENDING_BRANCH_AUTOSAVE_MS,
    mutate: (body, opts) => {
      saveBody(body, {
        onError: (error) => {
          opts.onError(error);
          showFailureToast(body);
        },
      });
    },
  });

  const applyDraft = useCallback((next: EndingBranchConfig) => {
    setDraft(next);
    draftRef.current = next;
    if (endingBranchConfigEqual(next, serverConfig)) {
      setDirty(false);
      cancel();
      return;
    }
    setDirty(true);
    if (hasInvalidSpecificPlayerTarget(next)) {
      cancel();
      toast.error("특정 플레이어 질문은 받을 캐릭터를 1명 이상 선택해야 합니다");
      return;
    }
    schedule({ draft: next });
  }, [cancel, schedule, serverConfig]);

  const handlePanelBlur = useCallback((event: FocusEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && panelRef.current?.contains(nextTarget)) return;
    flush();
  }, [flush]);

  const handleRemoveQuestion = (questionId: string) => {
    applyDraft(reorderPriorities({
      ...draft,
      questions: draft.questions.filter((question) => question.id !== questionId),
      matrix: draft.matrix.filter((row) => readChoiceCondition(row.condition)?.questionId !== questionId),
    }));
  };

  const handleChoiceChange = (questionId: string, choiceIndex: number, value: string) => {
    applyDraft(updateQuestionAt(draft, questionId, (question) => {
      const choices = updateChoiceValues(question, choiceIndex, value);
      return {
        ...question,
        choices,
        scoreMap: question.scoreMap
          ? Object.fromEntries(choices.map((choice, index) => [choice, question.scoreMap?.[question.choices[index]] ?? 0]))
          : undefined,
      };
    }));
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
    <section
      ref={panelRef}
      className={embedded ? "text-sm text-slate-300" : "rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300"}
      aria-label={section === "questions" ? "질문 관리" : "결말 판정 규칙"}
      onBlur={handlePanelBlur}
    >
      <Header section={section} embedded={embedded} settingsOnly={settingsOnly} />
      <Warnings warnings={viewModel.warnings} />
      <div className="mt-5">
        {section === "questions" ? (
        <EndingBranchQuestionList
          questions={draft.questions}
          characters={characters}
          onAddQuestion={() => applyDraft({ ...draft, questions: [...draft.questions, createEndingBranchQuestion(draft.questions.length)] })}
          onRemoveQuestion={handleRemoveQuestion}
          onChangeQuestion={(questionId, updater) => applyDraft(updateQuestionAt(draft, questionId, updater))}
          onChangeChoice={handleChoiceChange}
          onAddChoice={(questionId) => applyDraft(updateQuestionAt(draft, questionId, (question) => ({ ...question, choices: [...question.choices, createUniqueChoiceLabel(question)] })))}
          onRemoveChoice={handleRemoveChoice}
        />
        ) : (
        <EndingBranchOutcomeRules
          draft={draft}
          endingNodes={endingNodes}
          branchQuestions={branchQuestions}
          characters={characters}
          canAddRule={canAddRule}
          selectedEndingId={selectedEndingId}
          display={settingsOnly ? "settings" : selectedEndingId ? "rules" : "all"}
          onChange={applyDraft}
        />
        )}
      </div>
    </section>
  );
}

function Header({
  section,
  embedded,
  settingsOnly,
}: {
  section: "questions" | "endings";
  embedded: boolean;
  settingsOnly: boolean;
}) {
  const isQuestions = section === "questions";
  return (
    <div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-400">Ending Rules</p>
        <h3 className="mt-1 text-lg font-semibold text-slate-100">
          {isQuestions ? "질문 관리" : settingsOnly ? "결말 판정 설정" : embedded ? "이 결말로 가는 조건" : "결말 판정 규칙"}
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          {isQuestions
            ? "플레이어에게 진행할 최종 질문과 선택지를 설정합니다."
            : settingsOnly
              ? "규칙에 맞는 결말이 없을 때 보여줄 기본 결말과 복수 선택 기준을 설정합니다."
              : embedded
              ? "조건 그룹 중 하나라도 만족하면 이 결말이 플레이어에게 공개됩니다."
              : "질문 답변이 어떤 결말로 이어지는지 설정합니다. 내부 판정식은 자동으로 만들어집니다."}
        </p>
      </div>
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

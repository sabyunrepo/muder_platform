import { Plus, Trash2 } from "lucide-react";
import type { Node } from "@xyflow/react";
import type {
  EndingBranchConfig,
  EndingBranchQuestion,
} from "../../entities/ending/endingBranchAdapter";
import { readChoiceCondition, updateMatrixCondition } from "../../entities/ending/endingBranchAdapter";
import type { FlowNodeData } from "../../flowTypes";

interface EndingBranchOutcomeRulesProps {
  draft: EndingBranchConfig;
  endingNodes: Node[];
  branchQuestions: EndingBranchQuestion[];
  canAddRule: boolean;
  onChange: (next: EndingBranchConfig) => void;
  onAddRule: () => void;
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
  onAddRule,
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
        onAddRule={onAddRule}
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

function MatrixRulesCard({ draft, endingNodes, branchQuestions, canAddRule, onChange, onAddRule }: MatrixRulesCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-100">결말 규칙</h4>
          <p className="mt-1 text-xs leading-5 text-slate-400">위에서부터 먼저 맞는 규칙이 적용됩니다.</p>
        </div>
        <button type="button" onClick={onAddRule} disabled={!canAddRule} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 text-sm text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
          <Plus className="h-4 w-4" aria-hidden="true" /> 규칙 추가
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
          />
        ))}
      </div>
    </div>
  );
}

interface MatrixRuleRowProps {
  draft: EndingBranchConfig;
  rowIndex: number;
  endingNodes: Node[];
  branchQuestions: EndingBranchQuestion[];
  onChange: (next: EndingBranchConfig) => void;
}

function MatrixRuleRow({ draft, rowIndex, endingNodes, branchQuestions, onChange }: MatrixRuleRowProps) {
  const row = draft.matrix[rowIndex];
  const parsed = readChoiceCondition(row.condition);
  const selectedQuestion = branchQuestions.find((question) => question.id === parsed?.questionId) ?? branchQuestions[0];
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-slate-100">규칙 {rowIndex + 1}</p>
        <button type="button" onClick={() => onChange(reorderPriorities({ ...draft, matrix: draft.matrix.filter((_, index) => index !== rowIndex) }))} className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-200" aria-label={`규칙 ${rowIndex + 1} 삭제`}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3 grid gap-3">
        <QuestionSelect draft={draft} rowIndex={rowIndex} selectedQuestion={selectedQuestion} branchQuestions={branchQuestions} onChange={onChange} />
        <ChoiceSelect draft={draft} rowIndex={rowIndex} selectedQuestion={selectedQuestion} selectedChoice={parsed?.choice ?? ""} onChange={onChange} />
        <EndingSelect draft={draft} rowIndex={rowIndex} endingNodes={endingNodes} onChange={onChange} />
      </div>
    </article>
  );
}

function QuestionSelect({ draft, rowIndex, selectedQuestion, branchQuestions, onChange }: {
  draft: EndingBranchConfig;
  rowIndex: number;
  selectedQuestion?: EndingBranchQuestion;
  branchQuestions: EndingBranchQuestion[];
  onChange: (next: EndingBranchConfig) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-400">어떤 질문에서</span>
      <select value={selectedQuestion?.id ?? ""} onChange={(event) => {
        const question = branchQuestions.find((item) => item.id === event.target.value);
        onChange({ ...draft, matrix: draft.matrix.map((item, index) => index === rowIndex && question ? updateMatrixCondition(item, question.id, question.choices[0] ?? "") : item) });
      }} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
        <option value="">질문 선택</option>
        {branchQuestions.map((question) => <option key={question.id} value={question.id}>{question.text || "질문 내용 필요"}</option>)}
      </select>
    </label>
  );
}

function ChoiceSelect({ draft, rowIndex, selectedQuestion, selectedChoice, onChange }: {
  draft: EndingBranchConfig;
  rowIndex: number;
  selectedQuestion?: EndingBranchQuestion;
  selectedChoice: string;
  onChange: (next: EndingBranchConfig) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-400">어떤 선택이면</span>
      <select value={selectedChoice || selectedQuestion?.choices[0] || ""} onChange={(event) => selectedQuestion && onChange({ ...draft, matrix: draft.matrix.map((item, index) => index === rowIndex ? updateMatrixCondition(item, selectedQuestion.id, event.target.value) : item) })} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
        <option value="">선택지 선택</option>
        {selectedQuestion?.choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
      </select>
    </label>
  );
}

function EndingSelect({ draft, rowIndex, endingNodes, onChange }: {
  draft: EndingBranchConfig;
  rowIndex: number;
  endingNodes: Node[];
  onChange: (next: EndingBranchConfig) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-400">보여줄 결말</span>
      <select value={draft.matrix[rowIndex].ending} onChange={(event) => onChange({ ...draft, matrix: draft.matrix.map((item, index) => index === rowIndex ? { ...item, ending: event.target.value } : item) })} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
        <option value="">결말 선택</option>
        {endingNodes.map((node) => <option key={node.id} value={node.id}>{endingName(node)}</option>)}
      </select>
    </label>
  );
}

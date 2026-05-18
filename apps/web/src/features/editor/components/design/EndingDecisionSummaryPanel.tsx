import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { EndingDecisionSummary } from "../../entities/ending/endingEntityAdapter";
import { editorDesignClassNames } from "@/features/editor/design-system/editorDesignTokens";

interface EndingDecisionSummaryPanelProps {
  summary: EndingDecisionSummary;
}

export function EndingDecisionSummaryPanel({ summary }: EndingDecisionSummaryPanelProps) {
  return (
    <section
      className={`grid gap-3 p-4 text-sm md:grid-cols-3 ${editorDesignClassNames.panel}`}
      aria-label="결말 판정 준비"
    >
      <div>
        <p className="text-xs font-semibold uppercase text-[var(--mmp-editor-color-slate)]">결말 수</p>
        <p className="mt-1 text-lg font-semibold text-[var(--mmp-editor-color-charcoal)]">{summary.totalCount}개</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-[var(--mmp-editor-color-slate)]">본문 작성</p>
        <p className="mt-1 text-lg font-semibold text-[var(--mmp-editor-color-charcoal)]">
          {summary.readyCount}/{summary.totalCount}
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-[var(--mmp-editor-color-slate)]">기본 결말 후보</p>
        <p className="mt-1 text-lg font-semibold text-[var(--mmp-editor-color-charcoal)]">
          {summary.defaultEndingName ?? "아직 없음"}
        </p>
      </div>
      {summary.warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-100 md:col-span-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">확인할 점</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-5 text-amber-100/90">
                {summary.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-100 md:col-span-3">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          결말 본문과 도달 경로가 준비되어 있습니다.
        </div>
      )}
    </section>
  );
}

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { EndingDecisionSummary } from "../../entities/ending/endingEntityAdapter";

interface EndingDecisionSummaryPanelProps {
  summary: EndingDecisionSummary;
}

export function EndingDecisionSummaryPanel({ summary }: EndingDecisionSummaryPanelProps) {
  return (
    <section
      className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300 md:grid-cols-3"
      aria-label="결말 판정 준비"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">결말 수</p>
        <p className="mt-1 text-lg font-semibold text-slate-100">{summary.totalCount}개</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">본문 작성</p>
        <p className="mt-1 text-lg font-semibold text-slate-100">
          {summary.readyCount}/{summary.totalCount}
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">기본 결말 후보</p>
        <p className="mt-1 text-lg font-semibold text-slate-100">
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

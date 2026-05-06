import { AlertTriangle, Eye, MapPin, Search } from "lucide-react";

import { useEditorClues, useEditorLocations } from "@/features/editor/api";
import { buildRoundVisibilityPreview } from "@/features/editor/entities/validation/roundVisibilityPreview";

interface RoundVisibilityPreviewPanelProps {
  themeId: string;
}

function PreviewList({
  title,
  icon: Icon,
  items,
  emptyText,
}: {
  title: string;
  icon: typeof Search;
  items: Array<{ id: string; name: string; scheduleLabel: string }>;
  emptyText: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
        <Icon className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
        {title} {items.length}
      </div>
      <ul className="mt-2 space-y-1">
        {items.length === 0 ? (
          <li className="text-xs text-slate-600">{emptyText}</li>
        ) : (
          items.slice(0, 3).map((item) => (
            <li key={item.id} className="min-w-0 text-xs text-slate-300">
              <span className="block truncate">{item.name}</span>
              <span className="text-[10px] text-slate-500">{item.scheduleLabel}</span>
            </li>
          ))
        )}
        {items.length > 3 && (
          <li className="text-[10px] font-medium text-slate-500">외 {items.length - 3}개</li>
        )}
      </ul>
    </div>
  );
}

export function RoundVisibilityPreviewPanel({ themeId }: RoundVisibilityPreviewPanelProps) {
  const cluesQuery = useEditorClues(themeId);
  const locationsQuery = useEditorLocations(themeId);
  const previews = buildRoundVisibilityPreview(cluesQuery.data, locationsQuery.data);
  const warnings = previews.flatMap((preview) => preview.warnings);
  const isLoading = cluesQuery.isLoading || locationsQuery.isLoading;
  const isError = cluesQuery.isError || locationsQuery.isError;

  return (
    <section
      aria-label="라운드 공개 미리보기"
      className="border-b border-slate-800 bg-slate-950 px-4 py-4 sm:px-6"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-amber-500/10 p-2 text-amber-300">
            <Eye className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">라운드 공개 미리보기</h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              플레이어가 각 라운드에서 볼 수 있는 장소와 단서를 미리 확인합니다.
            </p>
          </div>
        </div>
        <div className="text-xs text-slate-400">
          {warnings.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-200">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              확인 필요 {warnings.length}개
            </span>
          ) : (
            <span className="inline-flex rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">
              라운드 공개 상태 정상
            </span>
          )}
        </div>
      </div>

      {isLoading && <p className="mt-3 text-xs text-slate-500">공개 상태를 불러오는 중입니다.</p>}
      {isError && (
        <p className="mt-3 rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-200">
          라운드 공개 상태를 불러오지 못했습니다.
        </p>
      )}

      {!isLoading && !isError && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {previews.map((preview) => (
            <article
              key={preview.round}
              className="min-w-[13.5rem] rounded-lg border border-slate-800 bg-slate-900/60 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-100">{preview.label}</h4>
                {preview.warnings.length > 0 && (
                  <span className="rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                    확인 {preview.warnings.length}
                  </span>
                )}
              </div>

              <div className="mt-3 grid gap-3">
                <PreviewList
                  title="장소"
                  icon={MapPin}
                  items={preview.locations}
                  emptyText="공개 장소 없음"
                />
                <PreviewList
                  title="단서"
                  icon={Search}
                  items={preview.clues}
                  emptyText="공개 단서 없음"
                />
              </div>

              {preview.warnings.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-slate-800 pt-2">
                  {preview.warnings.slice(0, 2).map((warning) => (
                    <li key={warning.id} className="text-[11px] leading-4 text-amber-200">
                      {warning.message}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

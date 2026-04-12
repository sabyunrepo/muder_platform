import { useThemeStore } from "@/stores/themeStore";
import { useTemplateSchema } from "@/features/editor/templateApi";
import { GenreSelect } from "./GenreSelect";
import { PresetSelect } from "./PresetSelect";
import { SchemaDrivenForm } from "./SchemaDrivenForm";

// ---------------------------------------------------------------------------
// TemplateConfigTab
// ---------------------------------------------------------------------------

export function TemplateConfigTab() {
  const { selectedPresetId, configValues, updateField } = useThemeStore();

  const {
    data: schema,
    isLoading: schemaLoading,
  } = useTemplateSchema(selectedPresetId ?? "");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">템플릿 설정</h2>
        <p className="mt-1 text-sm text-slate-400">
          장르와 프리셋을 선택하고 세부 설정을 조정하세요.
        </p>
      </div>

      <GenreSelect />
      <PresetSelect />

      {selectedPresetId && (
        <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            상세 설정
          </h3>
          {schema ? (
            <SchemaDrivenForm
              schema={schema}
              values={configValues}
              onChange={updateField}
              isLoading={schemaLoading}
            />
          ) : schemaLoading ? (
            <SchemaDrivenForm
              schema={{ type: "object", properties: {} }}
              values={configValues}
              onChange={updateField}
              isLoading={true}
            />
          ) : (
            <p className="text-sm text-slate-500">스키마를 불러올 수 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}

import { useThemeStore } from '@/stores/themeStore';
import { useTemplateSchema } from '@/features/editor/templateApi';
import { GenreSelect } from './GenreSelect';
import { PresetSelect } from './PresetSelect';
import { SchemaDrivenForm } from './SchemaDrivenForm';

// ---------------------------------------------------------------------------
// TemplateConfigTab
// ---------------------------------------------------------------------------

export function TemplateSettingsSection() {
  const { selectedPresetId, configValues, updateField } = useThemeStore();

  const { data: schema, isLoading: schemaLoading } = useTemplateSchema(selectedPresetId ?? '');

  return (
    <section className="space-y-5 rounded-sm border border-slate-800 bg-slate-950/40 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-100">게임 유형과 초기 프리셋</h3>
        <p className="text-xs leading-5 text-slate-400">
          장르와 초기 구조 프리셋을 고릅니다. 이 영역은 기본 메타데이터와 함께 관리되지만, 스토리
          진행 화면의 플로우 프리셋처럼 노드와 장면을 즉시 덮어쓰지는 않습니다.
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
              schema={{ type: 'object', properties: {} }}
              values={configValues}
              onChange={updateField}
              isLoading={true}
            />
          ) : (
            <p className="text-sm text-slate-500">스키마를 불러올 수 없습니다.</p>
          )}
        </div>
      )}
    </section>
  );
}

export function TemplateConfigTab() {
  return (
    <div className="space-y-6 p-6">
      <TemplateSettingsSection />
    </div>
  );
}

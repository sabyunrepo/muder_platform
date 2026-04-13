import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Settings } from 'lucide-react';
import type { EditorThemeResponse } from '@/features/editor/api';
import { useModuleSchemas, useUpdateConfigJson } from '@/features/editor/api';
import { SchemaDrivenForm } from '@/features/editor/components/SchemaDrivenForm';
import type { TemplateSchema } from '@/features/editor/templateApi';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SettingsSubTabProps {
  themeId: string;
  theme: EditorThemeResponse;
  moduleId: string;
}

// ---------------------------------------------------------------------------
// SettingsSubTab
// ---------------------------------------------------------------------------

export function SettingsSubTab({ themeId, theme, moduleId }: SettingsSubTabProps) {
  const { data: moduleSchemasResp, isLoading } = useModuleSchemas();
  const updateConfig = useUpdateConfigJson(themeId);

  const schema = useMemo((): TemplateSchema | null => {
    const raw = moduleSchemasResp?.schemas?.[moduleId];
    if (!raw) return null;
    // raw is a JSONSchemaProperty with type "object"; cast to TemplateSchema
    if (raw.type !== 'object') return null;
    return raw as unknown as TemplateSchema;
  }, [moduleSchemasResp, moduleId]);

  const moduleConfigs = useMemo((): Record<string, Record<string, unknown>> => {
    const cfg = theme.config_json ?? {};
    const mc = cfg.module_configs;
    return (mc && typeof mc === 'object' && !Array.isArray(mc))
      ? (mc as Record<string, Record<string, unknown>>)
      : {};
  }, [theme.config_json]);

  const currentValues = useMemo(
    () => moduleConfigs[moduleId] ?? {},
    [moduleConfigs, moduleId],
  );

  const handleChange = useCallback(
    (path: string, value: unknown) => {
      const updated: Record<string, unknown> = { ...currentValues, [path]: value };
      const nextConfig = {
        ...(theme.config_json ?? {}),
        module_configs: {
          ...moduleConfigs,
          [moduleId]: updated,
        },
      };
      updateConfig.mutate(nextConfig, {
        onSuccess: () => toast.success('설정이 저장되었습니다'),
        onError: () => toast.error('설정 저장에 실패했습니다'),
      });
    },
    [currentValues, moduleConfigs, moduleId, theme.config_json, updateConfig],
  );

  if (isLoading) {
    return (
      <div className="mt-4 rounded-sm border border-slate-800 bg-slate-900 px-4 py-6 text-center">
        <p className="text-xs font-mono text-slate-600">스키마 로딩 중...</p>
      </div>
    );
  }

  if (!schema || Object.keys(schema.properties ?? {}).length === 0) {
    return (
      <div className="mt-4 rounded-sm border border-dashed border-slate-800 px-4 py-8 text-center">
        <Settings className="mx-auto mb-2 h-4 w-4 text-slate-700" />
        <p className="text-xs font-mono uppercase tracking-widest text-slate-700">
          설정 항목 없음
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-sm border border-slate-800 bg-slate-900 px-4 py-4">
      <SchemaDrivenForm
        schema={schema}
        values={currentValues}
        onChange={handleChange}
      />
    </div>
  );
}

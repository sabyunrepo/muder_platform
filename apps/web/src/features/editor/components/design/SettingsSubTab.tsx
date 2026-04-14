import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Settings } from 'lucide-react';
import type { EditorThemeResponse } from '@/features/editor/api';
import { useModuleSchemas, useUpdateConfigJson } from '@/features/editor/api';
import { SchemaDrivenForm } from '@/features/editor/components/SchemaDrivenForm';
import { MODULE_CATEGORIES, REQUIRED_MODULE_IDS } from '@/features/editor/constants';
import type { TemplateSchema } from '@/features/editor/templateApi';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SettingsSubTabProps {
  themeId: string;
  theme: EditorThemeResponse;
}

// ---------------------------------------------------------------------------
// SettingsSubTab — all active modules' ConfigSchema forms
// ---------------------------------------------------------------------------

export function SettingsSubTab({ themeId, theme }: SettingsSubTabProps) {
  const { data: moduleSchemasResp, isLoading } = useModuleSchemas();
  const updateConfig = useUpdateConfigJson(themeId);

  const activeModuleIds = useMemo(() => {
    const cfg = theme.config_json ?? {};
    const mods = Array.isArray(cfg.modules) ? (cfg.modules as string[]) : [];
    return Array.from(new Set([...REQUIRED_MODULE_IDS, ...mods]));
  }, [theme.config_json]);

  const moduleConfigs = useMemo((): Record<string, Record<string, unknown>> => {
    const cfg = theme.config_json ?? {};
    const mc = cfg.module_configs;
    return (mc && typeof mc === 'object' && !Array.isArray(mc))
      ? (mc as Record<string, Record<string, unknown>>)
      : {};
  }, [theme.config_json]);

  const handleChange = useCallback(
    (moduleId: string, path: string, value: unknown) => {
      const current = moduleConfigs[moduleId] ?? {};
      const updated = { ...current, [path]: value };
      const nextConfig = {
        ...(theme.config_json ?? {}),
        module_configs: { ...moduleConfigs, [moduleId]: updated },
      };
      updateConfig.mutate(nextConfig, {
        onSuccess: () => toast.success('설정이 저장되었습니다'),
        onError: () => toast.error('설정 저장에 실패했습니다'),
      });
    },
    [moduleConfigs, theme.config_json, updateConfig],
  );

  // Collect modules that have schemas
  const modulesWithSchema = useMemo(() => {
    if (!moduleSchemasResp?.schemas) return [];
    const allModules = MODULE_CATEGORIES.flatMap((c) => c.modules);
    return activeModuleIds
      .map((id) => {
        const schema = moduleSchemasResp.schemas[id];
        if (!schema || schema.type !== 'object') return null;
        const info = allModules.find((m) => m.id === id);
        return { id, name: info?.name ?? id, schema: schema as unknown as TemplateSchema };
      })
      .filter(Boolean) as { id: string; name: string; schema: TemplateSchema }[];
  }, [moduleSchemasResp, activeModuleIds]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs font-mono text-slate-600">스키마 로딩 중...</p>
      </div>
    );
  }

  if (modulesWithSchema.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Settings className="mx-auto mb-3 h-8 w-8 text-slate-700" />
          <p className="text-xs font-mono uppercase tracking-widest text-slate-700">
            설정 가능한 모듈이 없습니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-lg space-y-6">
        {modulesWithSchema.map(({ id, name, schema }) => (
          <div key={id} className="rounded-sm border border-slate-800 bg-slate-900 p-4">
            <h3 className="mb-3 text-sm font-medium text-slate-300">{name}</h3>
            <SchemaDrivenForm
              schema={schema}
              values={moduleConfigs[id] ?? {}}
              onChange={(path, value) => handleChange(id, path, value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

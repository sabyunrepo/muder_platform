import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import type { EditorThemeResponse } from '@/features/editor/api';
import { useModuleSchemas, editorKeys } from '@/features/editor/api';
import { useUpdateConfigJson } from '@/features/editor/editorConfigApi';
import { queryClient } from '@/services/queryClient';
import { OPTIONAL_MODULE_CATEGORIES } from '@/features/editor/constants';
import type { TemplateSchema } from '@/features/editor/templateApi';
import { SchemaDrivenForm } from '@/features/editor/components/SchemaDrivenForm';

const CONFLICT_SNACKBAR_MSG = '동시 편집 충돌 — 최신 상태 다시 불러오기';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModulesSubTabProps {
  themeId: string;
  theme: EditorThemeResponse;
}

// ---------------------------------------------------------------------------
// ModulesSubTab — card + toggle UI (optional modules only)
// ---------------------------------------------------------------------------

export function ModulesSubTab({ themeId, theme }: ModulesSubTabProps) {
  const { data: moduleSchemasResp } = useModuleSchemas();
  // conflictRef distinguishes conflict-after-retry from generic errors in
  // onError. useRef avoids re-creating the hook on every render.
  const conflictRef = useRef(false);
  const updateConfig = useUpdateConfigJson(themeId, {
    onConflictAfterRetry: () => {
      conflictRef.current = true;
      queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
    },
  });

  const mutateConfig = useCallback(
    (nextConfig: Record<string, unknown>, successMsg: string, errorMsg: string) => {
      conflictRef.current = false;
      updateConfig.mutate(
        { ...nextConfig, version: theme.version },
        {
          onSuccess: () => toast.success(successMsg),
          onError: () => {
            if (conflictRef.current) {
              toast.error(CONFLICT_SNACKBAR_MSG);
            } else {
              toast.error(errorMsg);
            }
          },
        },
      );
    },
    [theme.version, updateConfig],
  );

  const serverModules = useMemo(() => {
    const cfg = theme.config_json ?? {};
    return Array.isArray(cfg.modules) ? (cfg.modules as string[]) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(theme.config_json?.modules)]);

  const moduleConfigs = useMemo((): Record<string, Record<string, unknown>> => {
    const cfg = theme.config_json ?? {};
    const mc = cfg.module_configs;
    return mc && typeof mc === 'object' && !Array.isArray(mc)
      ? (mc as Record<string, Record<string, unknown>>)
      : {};
  }, [theme.config_json]);

  const [selectedModules, setSelectedModules] = useState<string[]>(serverModules);

  useEffect(() => {
    setSelectedModules(serverModules);
  }, [serverModules]);

  const handleToggle = useCallback(
    (moduleId: string) => {
      setSelectedModules((prev) => {
        const next = prev.includes(moduleId)
          ? prev.filter((id) => id !== moduleId)
          : [...prev, moduleId];

        mutateConfig(
          { ...(theme.config_json ?? {}), modules: next },
          '모듈 설정이 저장되었습니다',
          '모듈 설정 저장에 실패했습니다',
        );

        return next;
      });
    },
    [theme.config_json, mutateConfig],
  );

  const handleConfigChange = useCallback(
    (moduleId: string, path: string, value: unknown) => {
      const current = moduleConfigs[moduleId] ?? {};
      const updated = { ...current, [path]: value };
      const nextConfig = {
        ...(theme.config_json ?? {}),
        module_configs: { ...moduleConfigs, [moduleId]: updated },
      };
      mutateConfig(nextConfig, '설정이 저장되었습니다', '설정 저장에 실패했습니다');
    },
    [moduleConfigs, theme.config_json, mutateConfig],
  );

  const schemaMap = useMemo((): Record<string, TemplateSchema | null> => {
    if (!moduleSchemasResp?.schemas) return {};
    const result: Record<string, TemplateSchema | null> = {};
    for (const cat of OPTIONAL_MODULE_CATEGORIES) {
      for (const mod of cat.modules) {
        const s = moduleSchemasResp.schemas[mod.id];
        result[mod.id] = s && s.type === 'object' ? (s as unknown as TemplateSchema) : null;
      }
    }
    return result;
  }, [moduleSchemasResp]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      {OPTIONAL_MODULE_CATEGORIES.map((category) => {
        const activeCount = category.modules.filter((m) =>
          selectedModules.includes(m.id),
        ).length;

        return (
          <section key={category.key}>
            {/* Category header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {category.label}
              </span>
              <span className="text-[10px] font-mono text-slate-600">
                {activeCount}/{category.modules.length}
              </span>
            </div>

            {/* Module cards */}
            <div className="space-y-2">
              {category.modules.map((mod) => {
                const isEnabled = selectedModules.includes(mod.id);
                const schema = schemaMap[mod.id] ?? null;

                return (
                  <div
                    key={mod.id}
                    className="rounded-lg border border-slate-700 bg-slate-800/50"
                  >
                    {/* Card header row */}
                    <div className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${isEnabled ? 'text-slate-200' : 'text-slate-500'}`}>
                          {mod.name}
                        </p>
                        <p className="text-[10px] text-slate-600 mt-0.5 truncate">
                          {mod.description}
                        </p>
                      </div>
                      {/* Toggle switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isEnabled}
                        aria-label={`${mod.name} ${isEnabled ? '비활성화' : '활성화'}`}
                        onClick={() => handleToggle(mod.id)}
                        className={`relative shrink-0 h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                          isEnabled ? 'bg-amber-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            isEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Inline config form when enabled and schema exists */}
                    {isEnabled && schema && (
                      <div className="border-t border-slate-700 px-3 py-3">
                        <SchemaDrivenForm
                          schema={schema}
                          values={moduleConfigs[mod.id] ?? {}}
                          onChange={(path, value) => handleConfigChange(mod.id, path, value)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

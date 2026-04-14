import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import type { EditorThemeResponse } from '@/features/editor/api';
import { useModuleSchemas, useUpdateConfigJson } from '@/features/editor/api';
import { MODULE_CATEGORIES } from '@/features/editor/constants';
import type { TemplateSchema } from '@/features/editor/templateApi';
import { ModuleAccordionItem } from './ModuleAccordionItem';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModulesSubTabProps {
  themeId: string;
  theme: EditorThemeResponse;
}

// ---------------------------------------------------------------------------
// ModulesSubTab — accordion list with inline ConfigSchema
// ---------------------------------------------------------------------------

export function ModulesSubTab({ themeId, theme }: ModulesSubTabProps) {
  const { data: moduleSchemasResp } = useModuleSchemas();
  const updateConfig = useUpdateConfigJson(themeId);

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
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedModules(serverModules);
  }, [serverModules]);

  const handleToggle = useCallback(
    (moduleId: string) => {
      setSelectedModules((prev) => {
        const next = prev.includes(moduleId)
          ? prev.filter((id) => id !== moduleId)
          : [...prev, moduleId];

        updateConfig.mutate(
          { ...(theme.config_json ?? {}), modules: next },
          {
            onSuccess: () => toast.success('모듈 설정이 저장되었습니다'),
            onError: () => toast.error('모듈 설정 저장에 실패했습니다'),
          },
        );

        return next;
      });
    },
    [theme.config_json, updateConfig],
  );

  const handleConfigChange = useCallback(
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

  const handleOpenChange = useCallback((moduleId: string, open: boolean) => {
    setOpenModuleId(open ? moduleId : null);
  }, []);

  const schemaMap = useMemo((): Record<string, TemplateSchema | null> => {
    if (!moduleSchemasResp?.schemas) return {};
    const result: Record<string, TemplateSchema | null> = {};
    for (const cat of MODULE_CATEGORIES) {
      for (const mod of cat.modules) {
        const s = moduleSchemasResp.schemas[mod.id];
        result[mod.id] = s && s.type === 'object' ? (s as unknown as TemplateSchema) : null;
      }
    }
    return result;
  }, [moduleSchemasResp]);

  return (
    <div className="h-full overflow-y-auto">
      {MODULE_CATEGORIES.map((category) => {
        const activeCount = category.modules.filter((m) =>
          selectedModules.includes(m.id),
        ).length;

        return (
          <div key={category.key} className="border-b border-slate-800 last:border-b-0">
            {/* Category header */}
            <div className="flex items-center justify-between bg-slate-950 px-4 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                {category.label}
              </span>
              <span className="text-[10px] font-mono text-slate-700">
                {activeCount}/{category.modules.length}
              </span>
            </div>

            {/* Module rows */}
            <div className="bg-slate-950/50">
              {category.modules.map((mod) => (
                <ModuleAccordionItem
                  key={mod.id}
                  mod={mod}
                  isEnabled={selectedModules.includes(mod.id)}
                  isOpen={openModuleId === mod.id}
                  schema={schemaMap[mod.id] ?? null}
                  moduleConfig={moduleConfigs[mod.id] ?? {}}
                  onToggle={handleToggle}
                  onOpenChange={handleOpenChange}
                  onConfigChange={handleConfigChange}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

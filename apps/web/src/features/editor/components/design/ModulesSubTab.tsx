import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import type { EditorThemeResponse } from '@/features/editor/api';
import { useModuleSchemas, editorKeys } from '@/features/editor/api';
import { useUpdateConfigJson } from '@/features/editor/editorConfigApi';
import { queryClient } from '@/services/queryClient';
import { OPTIONAL_MODULE_CATEGORIES } from '@/features/editor/constants';
import type { TemplateSchema } from '@/features/editor/templateApi';
import { EditorSaveConflictBanner } from '@/features/editor/components/EditorSaveConflictBanner';
import { SchemaDrivenForm } from '@/features/editor/components/SchemaDrivenForm';
import {
  DECK_INVESTIGATION_MODULE_ID,
  readDeckInvestigationConfig,
  writeDeckInvestigationConfig,
  type DeckInvestigationConfigDraft,
} from '@/features/editor/entities/deckInvestigation/deckInvestigationAdapter';
import { InvestigationTokenSettingsPanel } from './InvestigationTokenSettingsPanel';
import {
  readEnabledModuleIds,
  readModuleConfig,
  writeModuleConfigPath,
  writeModuleEnabled,
} from '@/features/editor/utils/configShape';

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
  const [conflictDraft, setConflictDraft] = useState<Record<string, unknown> | null>(null);
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
              setConflictDraft(nextConfig);
            } else {
              toast.error(errorMsg);
            }
          },
        },
      );
    },
    [theme.version, updateConfig],
  );

  const handleReloadAfterConflict = useCallback(() => {
    setConflictDraft(null);
    queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
  }, [themeId]);

  const handleCopyConflictDraft = useCallback(() => {
    const serialized = [
      '모듈 설정 변경 백업',
      '최신 상태를 다시 불러온 뒤 필요한 값을 참고해 다시 적용하세요.',
      '',
      JSON.stringify(conflictDraft ?? theme.config_json ?? {}, null, 2),
    ].join('\n');
    void navigator.clipboard?.writeText(serialized);
    toast.success('내 변경 내용을 클립보드에 복사했습니다');
  }, [conflictDraft, theme.config_json]);

  const serverModules = useMemo(
    () => readEnabledModuleIds(theme.config_json),
    [theme.config_json],
  );

  const moduleConfigs = useMemo((): Record<string, Record<string, unknown>> => {
    const result: Record<string, Record<string, unknown>> = {};
    for (const cat of OPTIONAL_MODULE_CATEGORIES) {
      for (const mod of cat.modules) {
        result[mod.id] = readModuleConfig(theme.config_json, mod.id);
      }
    }
    return result;
  }, [theme.config_json]);

  const [selectedModules, setSelectedModules] = useState<string[]>(serverModules);

  useEffect(() => {
    setSelectedModules(serverModules);
  }, [serverModules]);

  const handleToggle = useCallback(
    (moduleId: string) => {
      setSelectedModules((prev) => {
        const enabled = !prev.includes(moduleId);
        const next = enabled
          ? [...prev, moduleId]
          : prev.filter((id) => id !== moduleId);

        mutateConfig(
          writeModuleEnabled(theme.config_json, moduleId, enabled),
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
      const nextConfig = writeModuleConfigPath(theme.config_json, moduleId, path, value);
      mutateConfig(nextConfig, '설정이 저장되었습니다', '설정 저장에 실패했습니다');
    },
    [theme.config_json, mutateConfig],
  );

  const handleDeckInvestigationChange = useCallback(
    (draft: DeckInvestigationConfigDraft) => {
      mutateConfig(
        writeDeckInvestigationConfig(theme.config_json, draft),
        '조사권 설정이 저장되었습니다',
        '조사권 설정 저장에 실패했습니다',
      );
    },
    [theme.config_json, mutateConfig],
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
      {conflictDraft && (
        <EditorSaveConflictBanner
          scopeLabel="모듈 설정"
          onReload={handleReloadAfterConflict}
          onPreserve={handleCopyConflictDraft}
          onDismiss={() => setConflictDraft(null)}
        />
      )}

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

                    {isEnabled && mod.id === DECK_INVESTIGATION_MODULE_ID && (
                      <InvestigationTokenSettingsPanel
                        draft={readDeckInvestigationConfig(theme.config_json)}
                        isSaving={updateConfig.isPending}
                        onChange={handleDeckInvestigationChange}
                      />
                    )}

                    {/* Inline config form when enabled and schema exists */}
                    {isEnabled && mod.id !== DECK_INVESTIGATION_MODULE_ID && schema && (
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

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import type { EditorThemeResponse } from '@/features/editor/api';
import { useUpdateConfigJson, editorKeys } from '@/features/editor/api';
import { queryClient } from '@/services/queryClient';
import { MODULE_CATEGORIES, REQUIRED_MODULE_IDS } from '@/features/editor/constants';
import type { ModuleInfo } from '@/features/editor/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DesignTabProps {
  themeId: string;
  theme: EditorThemeResponse;
}

// ---------------------------------------------------------------------------
// DesignTab
// ---------------------------------------------------------------------------

export function DesignTab({ themeId, theme }: DesignTabProps) {
  const serverModules = useMemo(
    () => {
      const cfg = theme.config_json ?? {};
      const mods = Array.isArray(cfg.modules) ? (cfg.modules as string[]) : [];
      // 코어 모듈 항상 포함
      return Array.from(new Set([...REQUIRED_MODULE_IDS, ...mods]));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(theme.config_json?.modules)],
  );

  const [selectedModules, setSelectedModules] = useState<string[]>(serverModules);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const updateConfig = useUpdateConfigJson(themeId);

  // Refs for debounce: track latest modules value and timer
  const selectedModulesRef = useRef<string[]>(selectedModules);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configJsonRef = useRef(theme.config_json);

  // Keep refs in sync with latest values
  useEffect(() => {
    selectedModulesRef.current = selectedModules;
  }, [selectedModules]);

  useEffect(() => {
    configJsonRef.current = theme.config_json;
  }, [theme.config_json]);

  useEffect(() => {
    setSelectedModules(serverModules);
  }, [serverModules]);

  const handleToggle = useCallback((moduleId: string) => {
    // 필수 모듈은 토글 불가
    if (REQUIRED_MODULE_IDS.includes(moduleId)) return;

    // Update local state immediately (optimistic UI)
    setSelectedModules((prev) => {
      const next = prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId];
      selectedModulesRef.current = next;
      return next;
    });

    // Debounce the API call: clear any pending timer and schedule a new one
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;

      const doMutate = () => {
        updateConfig.mutate(
          { ...(configJsonRef.current ?? {}), modules: selectedModulesRef.current },
          {
            onSuccess: () => toast.success('모듈 설정이 저장되었습니다'),
            onError: () => {
              toast.error('모듈 설정 저장에 실패했습니다');
              // Rollback local state by re-fetching server data
              queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
            },
          },
        );
      };

      // If a previous mutation is still in flight, wait for it to settle first
      if (updateConfig.isPending) {
        const unsub = queryClient.getMutationCache().subscribe(() => {
          if (!updateConfig.isPending) {
            unsub();
            doMutate();
          }
        });
      } else {
        doMutate();
      }
    }, 500);
  }, [themeId, updateConfig]);

  const activeModule = useMemo((): ModuleInfo | null => {
    if (!activeModuleId) return null;
    for (const cat of MODULE_CATEGORIES) {
      const found = cat.modules.find((m) => m.id === activeModuleId);
      if (found) return found;
    }
    return null;
  }, [activeModuleId]);

  return (
    <div className="flex h-full">
      {/* ── Sidebar ── */}
      <aside className="w-60 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-950 py-4">
        {MODULE_CATEGORIES.map((category) => {
          const categoryModuleIds = category.modules.map((m) => m.id);
          const activeCount = categoryModuleIds.filter((id) =>
            selectedModules.includes(id),
          ).length;

          return (
            <div key={category.key} className="mb-4">
              {/* Category header */}
              <div className="flex items-center justify-between px-4 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                  {category.label}
                </span>
                <span className="text-[10px] font-mono text-slate-700">
                  {activeCount}/{category.modules.length}
                </span>
              </div>

              {/* Module rows */}
              {category.modules.map((mod) => {
                const isEnabled = selectedModules.includes(mod.id);
                const isActive = activeModuleId === mod.id;

                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => setActiveModuleId(isActive ? null : mod.id)}
                    className={`group flex w-full items-center gap-2.5 border-l-2 px-4 py-1.5 text-left transition-colors ${
                      isActive
                        ? 'border-amber-500 bg-slate-900 text-slate-200'
                        : 'border-transparent text-slate-500 hover:bg-slate-900/50 hover:text-slate-300'
                    } ${!mod.supported ? 'opacity-40' : ''}`}
                  >
                    {/* Toggle dot */}
                    <span
                      role="switch"
                      aria-checked={isEnabled}
                      tabIndex={mod.supported && !mod.required ? 0 : -1}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!mod.supported || mod.required) return;
                        handleToggle(mod.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!mod.supported || mod.required) return;
                          handleToggle(mod.id);
                        }
                      }}
                      aria-label={mod.required ? `${mod.name} 필수 모듈` : `${mod.name} ${isEnabled ? '비활성화' : '활성화'}`}
                      className={`shrink-0 focus:outline-none ${mod.required ? 'cursor-default' : mod.supported ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    >
                      <span
                        className={`block h-2 w-2 rounded-full transition-colors ${
                          !mod.supported
                            ? 'bg-slate-800'
                            : mod.required
                              ? 'bg-amber-500'
                              : isEnabled
                                ? 'bg-amber-500'
                                : 'bg-slate-700 group-hover:bg-slate-600'
                        }`}
                      />
                    </span>
                    <span className="truncate text-xs font-medium">{mod.name}</span>
                    {!mod.supported && (
                      <span className="ml-1 shrink-0 text-[10px] text-slate-600">(미지원)</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </aside>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {activeModule ? (
          <div className="max-w-lg">
            {/* Module header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-1">
                <span
                  className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                    selectedModules.includes(activeModule.id)
                      ? 'bg-amber-500'
                      : 'bg-slate-700'
                  }`}
                />
                <h2 className="text-base font-mono font-semibold text-slate-200">
                  {activeModule.name}
                </h2>
              </div>
              <p className="ml-[22px] text-xs text-slate-500">{activeModule.description}</p>
            </div>

            {/* Unsupported notice */}
            {!activeModule.supported && (
              <div className="mb-4 rounded-sm border border-slate-800 bg-slate-900/50 px-4 py-3">
                <p className="text-xs text-slate-500">
                  이 모듈은 아직 게임 UI가 구현되지 않았습니다.
                </p>
              </div>
            )}

            {/* Toggle */}
            <div className="rounded-sm border border-slate-800 bg-slate-900 px-4 py-3 flex items-center justify-between">
              {activeModule.required ? (
                <span className="text-xs text-amber-500/70">필수 모듈 — 항상 활성화</span>
              ) : (
                <>
                  <span className="text-xs text-slate-400">모듈 활성화</span>
                  <button
                    type="button"
                    onClick={() => activeModule.supported && handleToggle(activeModule.id)}
                    disabled={!activeModule.supported}
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                      activeModule.supported ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
                    } ${
                      selectedModules.includes(activeModule.id)
                        ? 'bg-amber-500'
                        : 'bg-slate-700'
                    }`}
                    role="switch"
                    aria-checked={selectedModules.includes(activeModule.id)}
                    aria-label={`${activeModule.name} 활성화 토글`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        selectedModules.includes(activeModule.id) ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </>
              )}
            </div>

            {/* Settings placeholder */}
            <div className="mt-4 rounded-sm border border-dashed border-slate-800 px-4 py-8 text-center">
              <p className="text-xs font-mono uppercase tracking-widest text-slate-700">
                모듈 설정 — 추후 구현
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="text-xs font-mono uppercase tracking-widest text-slate-700">
                좌측에서 모듈을 선택하세요
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
  PLAYER_KILL_MODULE_ID,
  readEnabledModuleIds,
  readLocationInvestigationSettings,
  readModuleConfig,
  readPlayerKillConfig,
  writeLocationInvestigationSettings,
  writeModuleConfigPath,
  writeModuleEnabled,
  writePlayerKillConfig,
  type LocationDeckOrder,
  type LocationInvestigationMode,
  type PlayerKillConfig,
} from '@/features/editor/utils/configShape';
import { showUnknownErrorToast } from '@/lib/show-error-toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModulesSubTabProps {
  themeId: string;
  theme: EditorThemeResponse;
}

const LOCATION_MODULE_ID = 'location';

// ---------------------------------------------------------------------------
// ModulesSubTab — card + toggle UI (optional modules only)
// ---------------------------------------------------------------------------

export function ModulesSubTab({ themeId, theme }: ModulesSubTabProps) {
  const { data: moduleSchemasResp } = useModuleSchemas();
  const [conflictDraft, setConflictDraft] = useState<Record<string, unknown> | null>(null);
  const [isConflictBannerDismissed, setConflictBannerDismissed] = useState(false);
  // conflictRef distinguishes conflict-after-retry from generic errors in
  // onError. useRef avoids re-creating the hook on every render.
  const conflictRef = useRef(false);
  const activeConfig = useMemo(
    () => conflictDraft ?? theme.config_json ?? {},
    [conflictDraft, theme.config_json]
  );
  const updateConfig = useUpdateConfigJson(themeId, {
    onConflictAfterRetry: () => {
      conflictRef.current = true;
      queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
    },
  });

  const mutateConfig = useCallback(
    (
      nextConfig: Record<string, unknown>,
      successMsg: string,
      errorMsg: string,
      onRollback?: () => void
    ) => {
      if (updateConfig.isPending) {
        return;
      }

      conflictRef.current = false;
      updateConfig.mutate(
        { ...nextConfig, version: theme.version },
        {
          onSuccess: () => {
            setConflictDraft(null);
            setConflictBannerDismissed(false);
            toast.success(successMsg);
          },
          onError: (error) => {
            if (conflictRef.current) {
              setConflictDraft(nextConfig);
              setConflictBannerDismissed(false);
            } else {
              onRollback?.();
              showUnknownErrorToast(error, errorMsg);
            }
          },
        }
      );
    },
    [theme.version, updateConfig]
  );

  const handleReloadAfterConflict = useCallback(() => {
    setConflictDraft(null);
    setConflictBannerDismissed(false);
    queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
  }, [themeId]);

  const handleCopyConflictDraft = useCallback(async () => {
    const serialized = [
      '모듈 설정 변경 백업',
      '최신 상태를 다시 불러온 뒤 필요한 값을 참고해 다시 적용하세요.',
      '',
      JSON.stringify(conflictDraft ?? theme.config_json ?? {}, null, 2),
    ].join('\n');
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API is not available');
      }
      await navigator.clipboard.writeText(serialized);
      toast.success('내 변경 내용을 클립보드에 복사했습니다');
    } catch {
      toast.error('클립보드에 복사할 수 없습니다');
    }
  }, [conflictDraft, theme.config_json]);

  const serverModules = useMemo(() => readEnabledModuleIds(activeConfig), [activeConfig]);

  const moduleConfigs = useMemo((): Record<string, Record<string, unknown>> => {
    const result: Record<string, Record<string, unknown>> = {};
    for (const cat of OPTIONAL_MODULE_CATEGORIES) {
      for (const mod of cat.modules) {
        result[mod.id] = readModuleConfig(activeConfig, mod.id);
      }
    }
    return result;
  }, [activeConfig]);

  const [selectedModules, setSelectedModules] = useState<string[]>(serverModules);

  useEffect(() => {
    setSelectedModules(serverModules);
  }, [serverModules]);

  const handleToggle = useCallback(
    (moduleId: string) => {
      if (updateConfig.isPending) {
        return;
      }

      setSelectedModules((prev) => {
        const enabled = !prev.includes(moduleId);
        const next = enabled ? [...prev, moduleId] : prev.filter((id) => id !== moduleId);

        mutateConfig(
          writeModuleEnabled(activeConfig, moduleId, enabled),
          '모듈 설정이 저장되었습니다',
          '모듈 설정 저장에 실패했습니다',
          () => setSelectedModules(prev)
        );

        return next;
      });
    },
    [activeConfig, mutateConfig, updateConfig.isPending]
  );

  const handleConfigChange = useCallback(
    (moduleId: string, path: string, value: unknown) => {
      if (updateConfig.isPending) {
        return;
      }

      const nextConfig = writeModuleConfigPath(activeConfig, moduleId, path, value);
      mutateConfig(nextConfig, '설정이 저장되었습니다', '설정 저장에 실패했습니다');
    },
    [activeConfig, mutateConfig, updateConfig.isPending]
  );

  const handleDeckInvestigationChange = useCallback(
    (draft: DeckInvestigationConfigDraft) => {
      if (updateConfig.isPending) {
        return;
      }

      mutateConfig(
        writeDeckInvestigationConfig(activeConfig, draft),
        '조사권 설정이 저장되었습니다',
        '조사권 설정 저장에 실패했습니다'
      );
    },
    [activeConfig, mutateConfig, updateConfig.isPending]
  );

  const handleLocationInvestigationChange = useCallback(
    (settings: { investigationMode: LocationInvestigationMode; deckOrder: LocationDeckOrder }) => {
      if (updateConfig.isPending) {
        return;
      }

      mutateConfig(
        writeLocationInvestigationSettings(activeConfig, settings),
        '장소 탐색 설정이 저장되었습니다',
        '장소 탐색 설정 저장에 실패했습니다'
      );
    },
    [activeConfig, mutateConfig, updateConfig.isPending]
  );

  const handlePlayerKillConfigChange = useCallback(
    (settings: PlayerKillConfig) => {
      if (updateConfig.isPending) {
        return;
      }

      mutateConfig(
        writePlayerKillConfig(activeConfig, settings),
        '플레이어킬 설정이 저장되었습니다',
        '플레이어킬 설정 저장에 실패했습니다'
      );
    },
    [activeConfig, mutateConfig, updateConfig.isPending]
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
      {conflictDraft && !isConflictBannerDismissed && (
        <EditorSaveConflictBanner
          scopeLabel="모듈 설정"
          onReload={handleReloadAfterConflict}
          onPreserve={handleCopyConflictDraft}
          onDismiss={() => setConflictBannerDismissed(true)}
        />
      )}

      {OPTIONAL_MODULE_CATEGORIES.map((category) => {
        const activeCount = category.modules.filter((m) => selectedModules.includes(m.id)).length;

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
                  <div key={mod.id} className="rounded-lg border border-slate-700 bg-slate-800/50">
                    {/* Card header row */}
                    <div className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs font-medium ${isEnabled ? 'text-slate-200' : 'text-slate-500'}`}
                        >
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
                        disabled={updateConfig.isPending}
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
                        draft={readDeckInvestigationConfig(activeConfig)}
                        isSaving={updateConfig.isPending}
                        onChange={handleDeckInvestigationChange}
                      />
                    )}

                    {isEnabled && mod.id === LOCATION_MODULE_ID && (
                      <LocationInvestigationModePanel
                        settings={readLocationInvestigationSettings(activeConfig)}
                        isSaving={updateConfig.isPending}
                        onChange={handleLocationInvestigationChange}
                      />
                    )}

                    {isEnabled && mod.id === PLAYER_KILL_MODULE_ID && (
                      <PlayerKillSettingsPanel
                        settings={readPlayerKillConfig(activeConfig)}
                        isSaving={updateConfig.isPending}
                        onChange={handlePlayerKillConfigChange}
                      />
                    )}

                    {/* Inline config form when enabled and schema exists */}
                    {isEnabled &&
                      mod.id !== DECK_INVESTIGATION_MODULE_ID &&
                      mod.id !== LOCATION_MODULE_ID &&
                      mod.id !== PLAYER_KILL_MODULE_ID &&
                      schema && (
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

function PlayerKillSettingsPanel({
  settings,
  isSaving,
  onChange,
}: {
  settings: PlayerKillConfig;
  isSaving: boolean;
  onChange: (settings: PlayerKillConfig) => void;
}) {
  const modes: Array<{
    value: PlayerKillConfig['killResolutionMode'];
    label: string;
    description: string;
  }> = [
    {
      value: 'all_weapons_vs_all_armor',
      label: '무기 모두 vs 방어구 모두',
      description: '공격자의 모든 공격 단서 합계와 대상의 모든 방어 단서 합계를 비교합니다.',
    },
    {
      value: 'best_weapon_vs_all_armor',
      label: '최고 무기 1개 vs 방어구 모두',
      description: '공격자의 가장 강한 공격 단서 1개와 대상의 모든 방어 단서 합계를 비교합니다.',
    },
    {
      value: 'best_weapon_vs_best_armor',
      label: '최고 무기 1개 vs 최고 방어구 1개',
      description: '공격자의 최고 공격력 1개와 대상의 최고 방어력 1개를 비교합니다.',
    },
  ];
  return (
    <div className="space-y-3 border-t border-slate-700 px-3 py-3">
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-slate-200">살해 판정 방식</legend>
        <div className="grid gap-2 lg:grid-cols-3">
          {modes.map((mode) => (
            <label
              key={mode.value}
              className={`flex min-h-24 cursor-pointer gap-2 rounded-md border px-3 py-2 text-left ${
                settings.killResolutionMode === mode.value
                  ? 'border-red-400 bg-red-500/10'
                  : 'border-slate-700 bg-slate-950'
              }`}
            >
              <input
                type="radio"
                name="killResolutionMode"
                aria-label={mode.label}
                checked={settings.killResolutionMode === mode.value}
                disabled={isSaving}
                onChange={() => onChange({ ...settings, killResolutionMode: mode.value })}
                className="mt-0.5 h-4 w-4 border-slate-700 bg-slate-900 text-red-500 focus:ring-red-500"
              />
              <span>
                <span className="block text-xs font-semibold text-slate-100">{mode.label}</span>
                <span className="mt-1 block text-[10px] leading-4 text-slate-500">
                  {mode.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label
        className="flex min-h-14 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-left"
        title="살해된 플레이어가 음성채팅에서 말하지 못하게 막습니다."
      >
        <input
          type="checkbox"
          aria-label="살해시 마이크 끔"
          checked={settings.muteOnKilled}
          disabled={isSaving}
          onChange={(event) => onChange({ ...settings, muteOnKilled: event.currentTarget.checked })}
          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
        />
        <span>
          <span className="block text-xs font-semibold text-slate-200">살해시 마이크 끔</span>
          <span className="mt-1 block text-[10px] leading-4 text-slate-500">
            사망 처리된 플레이어는 음성채팅에서 말할 수 없습니다.
          </span>
        </span>
      </label>
    </div>
  );
}

function LocationInvestigationModePanel({
  settings,
  isSaving,
  onChange,
}: {
  settings: {
    investigationMode: LocationInvestigationMode;
    deckOrder: LocationDeckOrder;
  };
  isSaving: boolean;
  onChange: (settings: {
    investigationMode: LocationInvestigationMode;
    deckOrder: LocationDeckOrder;
  }) => void;
}) {
  const modes: Array<{ value: LocationInvestigationMode; label: string; description: string }> = [
    {
      value: 'list',
      label: '리스트형',
      description: '세부 항목별 단서를 제작자가 정한 목록으로 보여줍니다.',
    },
    {
      value: 'deck',
      label: '덱형',
      description: '장소에 쌓인 단서를 한 번에 하나씩 뽑아 획득합니다.',
    },
  ];
  const orders: Array<{ value: LocationDeckOrder; label: string }> = [
    { value: 'fixed', label: '설정 순서' },
    { value: 'random', label: '랜덤' },
  ];

  return (
    <div className="border-t border-slate-700 px-3 py-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {modes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            disabled={isSaving}
            onClick={() => onChange({ ...settings, investigationMode: mode.value })}
            className={`rounded-md border px-3 py-2 text-left transition ${
              settings.investigationMode === mode.value
                ? 'border-amber-500/60 bg-amber-500/10 text-amber-100'
                : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
            }`}
          >
            <span className="block text-xs font-semibold">{mode.label}</span>
            <span className="mt-1 block text-[10px] leading-4 text-slate-500">
              {mode.description}
            </span>
          </button>
        ))}
      </div>
      {settings.investigationMode === 'deck' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {orders.map((order) => (
            <button
              key={order.value}
              type="button"
              disabled={isSaving}
              onClick={() => onChange({ ...settings, deckOrder: order.value })}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                settings.deckOrder === order.value
                  ? 'border-amber-500/60 bg-amber-500/10 text-amber-100'
                  : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
              }`}
            >
              {order.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

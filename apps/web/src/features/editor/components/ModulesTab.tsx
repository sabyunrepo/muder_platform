import { useState, useCallback, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Button, Badge } from "@/shared/components/ui";
import type { EditorThemeResponse } from "@/features/editor/api";
import { useUpdateConfigJson } from "@/features/editor/api";
import { MODULE_CATEGORIES } from "@/features/editor/constants";
import type { ModuleCategory } from "@/features/editor/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModulesTabProps {
  themeId: string;
  theme: EditorThemeResponse;
}

// ---------------------------------------------------------------------------
// CategorySection
// ---------------------------------------------------------------------------

interface CategorySectionProps {
  category: ModuleCategory;
  selectedModules: string[];
  onToggle: (moduleId: string) => void;
  onSelectAll: (moduleIds: string[]) => void;
  onDeselectAll: (moduleIds: string[]) => void;
  isPending: boolean;
}

function CategorySection({
  category,
  selectedModules,
  onToggle,
  onSelectAll,
  onDeselectAll,
  isPending,
}: CategorySectionProps) {
  const [expanded, setExpanded] = useState(true);

  const categoryModuleIds = category.modules.map((m) => m.id);
  const selectedCount = categoryModuleIds.filter((id) =>
    selectedModules.includes(id),
  ).length;
  const allSelected = selectedCount === category.modules.length;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50">
      {/* Category header */}
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
          <span className="text-sm font-medium uppercase tracking-wider text-slate-300">
            {category.label}
          </span>
          <Badge variant={selectedCount > 0 ? "warning" : "default"} size="sm">
            {selectedCount}/{category.modules.length}
          </Badge>
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-slate-700 px-4 py-3 space-y-3">
          {/* Select all / deselect all */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending || allSelected}
              onClick={() => onSelectAll(categoryModuleIds)}
            >
              전체 선택
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending || selectedCount === 0}
              onClick={() => onDeselectAll(categoryModuleIds)}
            >
              전체 해제
            </Button>
          </div>

          {/* Module list */}
          <div className="space-y-2">
            {category.modules.map((mod) => {
              const checked = selectedModules.includes(mod.id);
              return (
                <label
                  key={mod.id}
                  className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-slate-700/50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isPending}
                    onChange={() => onToggle(mod.id)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <div className="min-w-0">
                    <span className="block text-sm font-medium text-slate-200">
                      {mod.name}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {mod.description}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ModulesTab
// ---------------------------------------------------------------------------

export function ModulesTab({ themeId, theme }: ModulesTabProps) {
  const configJson = theme.config_json ?? {};
  const serverModules = (
    Array.isArray(configJson.modules) ? configJson.modules : []
  ) as string[];

  const [selectedModules, setSelectedModules] = useState<string[]>(serverModules);
  const updateConfig = useUpdateConfigJson(themeId);

  // Sync local state when server data changes (e.g. after save)
  useEffect(() => {
    setSelectedModules(serverModules);
  }, [JSON.stringify(serverModules)]);

  const isDirty = JSON.stringify(selectedModules.slice().sort()) !== JSON.stringify(serverModules.slice().sort());

  const handleToggle = useCallback(
    (moduleId: string) => {
      setSelectedModules((prev) =>
        prev.includes(moduleId)
          ? prev.filter((id) => id !== moduleId)
          : [...prev, moduleId],
      );
    },
    [],
  );

  const handleSelectAll = useCallback(
    (moduleIds: string[]) => {
      setSelectedModules((prev) =>
        Array.from(new Set([...prev, ...moduleIds])),
      );
    },
    [],
  );

  const handleDeselectAll = useCallback(
    (moduleIds: string[]) => {
      setSelectedModules((prev) =>
        prev.filter((id) => !moduleIds.includes(id)),
      );
    },
    [],
  );

  function handleSave() {
    updateConfig.mutate(
      { ...configJson, modules: selectedModules },
      {
        onSuccess: () => toast.success("모듈 설정이 저장되었습니다"),
        onError: () => toast.error("모듈 설정 저장에 실패했습니다"),
      },
    );
  }

  function handleReset() {
    setSelectedModules(serverModules);
  }

  const totalSelected = selectedModules.length;
  const totalModules = MODULE_CATEGORIES.reduce(
    (sum, cat) => sum + cat.modules.length,
    0,
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-100">모듈 선택</h2>
          <Badge variant={totalSelected > 0 ? "warning" : "default"}>
            {totalSelected}/{totalModules} 모듈 선택됨
          </Badge>
          {isDirty && <Badge variant="warning">변경사항 있음</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReset}
            disabled={!isDirty || updateConfig.isPending}
          >
            초기화
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            isLoading={updateConfig.isPending}
            disabled={!isDirty}
          >
            저장
          </Button>
        </div>
      </div>

      {/* Category sections */}
      <div className="space-y-3">
        {MODULE_CATEGORIES.map((category) => (
          <CategorySection
            key={category.key}
            category={category}
            selectedModules={selectedModules}
            onToggle={handleToggle}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            isPending={false}
          />
        ))}
      </div>
    </div>
  );
}

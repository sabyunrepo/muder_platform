import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ModuleInfo } from '@/features/editor/constants';
import { SchemaDrivenForm } from '@/features/editor/components/SchemaDrivenForm';
import type { TemplateSchema } from '@/features/editor/templateApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModuleAccordionItemProps {
  mod: ModuleInfo;
  isEnabled: boolean;
  isOpen: boolean;
  schema: TemplateSchema | null;
  moduleConfig: Record<string, unknown>;
  onToggle: (moduleId: string) => void;
  onOpenChange: (moduleId: string, open: boolean) => void;
  onConfigChange: (moduleId: string, path: string, value: unknown) => void;
}

// ---------------------------------------------------------------------------
// ModuleAccordionItem
// ---------------------------------------------------------------------------

export function ModuleAccordionItem({
  mod,
  isEnabled,
  isOpen,
  schema,
  moduleConfig,
  onToggle,
  onOpenChange,
  onConfigChange,
}: ModuleAccordionItemProps) {
  const hasSchema = schema !== null;
  const canExpand = isEnabled && hasSchema;

  return (
    <div className="border-b border-slate-800 last:border-b-0">
      {/* Row */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Toggle dot */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(mod.id);
          }}
          aria-label={`${mod.name} ${isEnabled ? '비활성화' : '활성화'}`}
          className="shrink-0 focus:outline-none"
        >
          <span
            className={`block h-2.5 w-2.5 rounded-full transition-colors ${
              isEnabled ? 'bg-amber-500' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          />
        </button>

        {/* Name + description */}
        <button
          type="button"
          disabled={!canExpand}
          onClick={() => canExpand && onOpenChange(mod.id, !isOpen)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left focus:outline-none disabled:cursor-default"
        >
          <span
            className={`truncate text-xs font-medium ${
              isEnabled ? 'text-slate-200' : 'text-slate-500'
            }`}
          >
            {mod.name}
          </span>
          <span className="hidden truncate text-[10px] text-slate-600 sm:block">
            {mod.description}
          </span>
        </button>

        {/* Chevron */}
        {canExpand && (
          <button
            type="button"
            onClick={() => onOpenChange(mod.id, !isOpen)}
            className="shrink-0 focus:outline-none"
            aria-label={`${mod.name} 설정 ${isOpen ? '접기' : '펼치기'}`}
          >
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
            )}
          </button>
        )}
      </div>

      {/* Accordion body */}
      {isOpen && canExpand && schema && (
        <div className="border-t border-slate-800 bg-slate-900/50 px-6 py-4">
          <SchemaDrivenForm
            schema={schema}
            values={moduleConfig}
            onChange={(path, value) => onConfigChange(mod.id, path, value)}
          />
        </div>
      )}

      {/* No-schema hint when enabled */}
      {isOpen && isEnabled && !hasSchema && (
        <div className="border-t border-slate-800 px-6 py-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-700">
            설정 없음
          </p>
        </div>
      )}
    </div>
  );
}

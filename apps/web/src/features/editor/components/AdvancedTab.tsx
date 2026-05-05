import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import type { EditorThemeResponse } from '@/features/editor/api';
import { useValidateTheme } from '@/features/editor/api';
import { useEditorUI } from '@/features/editor/stores/editorUIStore';
import type { EditorTab } from '@/features/editor/constants';
import { validateGameDesign } from '@/features/editor/validation';
import type { DesignWarning } from '@/features/editor/validation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdvancedTabProps {
  themeId: string;
  theme: EditorThemeResponse;
}

type ValidationSeverity = 'ok' | 'error' | 'warning';

interface ValidationItem {
  severity: ValidationSeverity;
  message: string;
  tab?: EditorTab;
}

// ---------------------------------------------------------------------------
// ValidationRow
// ---------------------------------------------------------------------------

interface ValidationRowProps {
  item: ValidationItem;
  onNavigate?: (tab: EditorTab) => void;
}

function ValidationRow({ item, onNavigate }: ValidationRowProps) {
  const icons: Record<ValidationSeverity, React.ReactNode> = {
    ok: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />,
    error: <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />,
    warning: <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />,
  };

  const textColors: Record<ValidationSeverity, string> = {
    ok: 'text-emerald-400',
    error: 'text-red-400',
    warning: 'text-amber-400',
  };

  return (
    <div
      className={`flex items-start gap-2 py-1.5 ${
        item.tab ? 'cursor-pointer hover:opacity-80' : ''
      }`}
      role={item.tab ? 'button' : undefined}
      tabIndex={item.tab ? 0 : undefined}
      onClick={() => item.tab && onNavigate?.(item.tab)}
      onKeyDown={(e) => e.key === 'Enter' && item.tab && onNavigate?.(item.tab)}
    >
      {icons[item.severity]}
      <span className={`text-xs ${textColors[item.severity]}`}>{item.message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdvancedTab
// ---------------------------------------------------------------------------

export function AdvancedTab({ themeId, theme }: AdvancedTabProps) {
  const [validationItems, setValidationItems] = useState<ValidationItem[] | null>(null);

  const validateTheme = useValidateTheme(themeId);
  const { setActiveTab } = useEditorUI();

  const handleValidate = () => {
    validateTheme.mutate(undefined, {
      onSuccess: (result) => {
        const items: ValidationItem[] = result.errors.map((msg) => ({
          severity: 'error',
          message: msg,
        }));

        // Client-side design warnings from config_json
        const configJson = theme.config_json ?? {};
        const designWarnings: DesignWarning[] = validateGameDesign(
          configJson,
          result.stats.clues,
          result.stats.characters,
        );
        for (const w of designWarnings) {
          items.push({
            severity: w.type,
            message: `[${w.category}] ${w.message}`,
          });
        }

        const hasErrors = items.some((i) => i.severity === 'error');
        if (!hasErrors) {
          items.unshift({ severity: 'ok', message: '모든 검증을 통과했습니다' });
          toast.success('검증 완료');
        } else {
          toast.error(`검증 실패: ${items.filter((i) => i.severity === 'error').length}개 오류`);
        }
        setValidationItems(items);
      },
      onError: () => {
        toast.error('검증 요청에 실패했습니다');
      },
    });
  };

  return (
    <div className="grid min-h-full gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-100">제작 검수</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              현재 제작 흐름에서 누락된 단서, 등장인물, 장면 연결을 확인합니다.
              내부 저장 구조는 기본 제작 화면에서 직접 편집하지 않습니다.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            검수 기준
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              단서와 등장인물이 서로 참조 가능한 상태인지 확인합니다.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              장면 흐름과 조건 분기가 끊기지 않았는지 확인합니다.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              저장된 제작 규칙을 사용자에게 필요한 말로 요약합니다.
            </li>
          </ul>
        </div>
      </div>

      {/* ── Validation Panel ── */}
      <div className="flex min-h-[18rem] flex-col rounded-lg border border-slate-800 bg-slate-950">
        <div className="border-b border-slate-800 bg-slate-900 px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            검증 결과
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {validationItems ? (
            <div className="space-y-0.5">
              {validationItems.map((item, i) => (
                <ValidationRow
                  key={i}
                  item={item}
                  onNavigate={setActiveTab}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-500">
              아직 검증을 실행하지 않았습니다. 아래 버튼으로 현재 제작 상태를 확인하세요.
            </p>
          )}
        </div>

        <div className="border-t border-slate-800 px-4 py-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleValidate}
            isLoading={validateTheme.isPending}
            className="w-full"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            지금 검증
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button, Badge } from '@/shared/components/ui';
import type { EditorThemeResponse } from '@/features/editor/api';
import { useUpdateConfigJson, useValidateTheme } from '@/features/editor/api';
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
// Helpers
// ---------------------------------------------------------------------------

function serialize(value: Record<string, unknown> | null): string {
  return JSON.stringify(value ?? {}, null, 2);
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
  const serverText = serialize(theme.config_json);
  const [text, setText] = useState(serverText);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationItems, setValidationItems] = useState<ValidationItem[] | null>(null);

  const updateConfig = useUpdateConfigJson(themeId);
  const validateTheme = useValidateTheme(themeId);
  const { setActiveTab } = useEditorUI();

  useEffect(() => {
    setText(serverText);
    setParseError(null);
  }, [serverText]);

  const isDirty = text !== serverText;
  const lines = text.split('\n');

  const handleSave = () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      setParseError('유효하지 않은 JSON 형식입니다');
      return;
    }
    setParseError(null);
    updateConfig.mutate(parsed, {
      onSuccess: () => toast.success('설정이 저장되었습니다'),
      onError: () => toast.error('설정 저장에 실패했습니다'),
    });
  };

  const handleReset = () => {
    setText(serverText);
    setParseError(null);
  };

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
    <div className="flex h-full flex-col lg:flex-row">
      {/* ── JSON Editor ── */}
      <div className="flex flex-1 flex-col overflow-hidden border-b border-slate-800 lg:border-b-0 lg:border-r">
        {/* Editor header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-medium text-slate-400">config_json</span>
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

        {/* Editor with line numbers */}
        <div className="relative flex flex-1 overflow-auto font-mono">
          {/* Line numbers */}
          <div className="sticky left-0 z-10 w-10 shrink-0 select-none overflow-hidden border-r border-slate-800 bg-slate-950 py-3">
            {lines.map((_, i) => (
              <div
                key={i}
                className="text-right pr-2 text-[11px] leading-5 text-slate-700"
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (parseError) setParseError(null);
            }}
            spellCheck={false}
            className="flex-1 bg-slate-950 py-3 pl-3 pr-4 font-mono text-sm leading-5 text-slate-300 caret-amber-500 selection:bg-amber-500/20 focus:outline-none resize-none min-h-[400px]"
          />
        </div>

        {/* Parse error */}
        {parseError && (
          <div className="border-t border-slate-800 bg-red-500/5 px-4 py-2">
            <p className="text-xs text-red-400">{parseError}</p>
          </div>
        )}
      </div>

      {/* ── Validation Panel ── */}
      <div className="w-full lg:w-72 shrink-0 flex flex-col bg-slate-950">
        <div className="border-b border-slate-800 bg-slate-900 px-4 py-2">
          <span className="text-xs font-mono font-medium text-slate-400">검증 결과</span>
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
            <p className="text-xs text-slate-700 font-mono">
              검증 버튼을 클릭하세요
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

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Spinner, ThemeModeToggle } from '@/shared/components/ui';
import type { EditorThemeResponse } from '@/features/editor/api';
import { useEditorUI } from '@/features/editor/stores/editorUIStore';
import { SaveIndicator } from './SaveIndicator';
import { EditorTabNav } from './EditorTabNav';
import { TabContent } from './TabContent';
import { ValidationPanel } from './ValidationPanel';
import { STATUS_LABEL } from '@/features/editor/constants';
import type { EditorTab } from '@/features/editor/constants';
import type { DesignWarning } from '@/features/editor/validation';
import type { SaveStatus } from '@/features/editor/hooks/useAutoSave';
import { readEnabledModuleIds } from '@/features/editor/utils/configShape';
import { readEditorTabFromRouteSegment } from '@/features/editor/routeSegments';
import { editorDesignClassNames } from '@/features/editor/design-system/editorDesignTokens';

// ---------------------------------------------------------------------------
// EditorLayout
// ---------------------------------------------------------------------------

interface EditorLayoutProps {
  theme: EditorThemeResponse;
  themeId: string;
  saveStatus?: SaveStatus;
  lastSaved?: Date | null;
  onSave?: () => void;
  onRetry?: () => void;
  onPublish?: () => void;
  isPublishing?: boolean;
  onValidate?: () => DesignWarning[];
  validationWarnings?: DesignWarning[];
  routeSegment?: string;
}

export function EditorLayout({
  theme,
  themeId,
  saveStatus = 'idle',
  lastSaved,
  onSave,
  onRetry,
  onPublish,
  isPublishing = false,
  onValidate,
  validationWarnings: externalWarnings,
  routeSegment,
}: EditorLayoutProps) {
  const navigate = useNavigate();
  const { activeTab } = useEditorUI();
  const [validationResult, setValidationResult] = useState<DesignWarning[] | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [publishNotice, setPublishNotice] = useState<string | null>(null);

  const activeModules = useMemo(() => readEnabledModuleIds(theme.config_json), [theme.config_json]);
  const routeTab = useMemo(
    () => (routeSegment ? readEditorTabFromRouteSegment(routeSegment) : undefined),
    [routeSegment]
  );
  const effectiveTab = routeTab ?? activeTab;
  const usesInternalScroll = INTERNAL_SCROLL_TABS.has(effectiveTab);

  const runValidation = () => {
    const result = onValidate ? onValidate() : (externalWarnings ?? []);
    setValidationResult(result);
    setDismissed(false);
    return result;
  };

  const handleValidate = () => {
    runValidation();
    setPublishNotice(null);
  };

  const handlePublish = () => {
    const result = runValidation();
    const hasErrors = result.some((warning) => warning.type === 'error');
    if (hasErrors) {
      setPublishNotice('검증 오류를 먼저 해결해야 출판할 수 있습니다');
      return;
    }
    setPublishNotice(null);
    onPublish?.();
  };

  // Save on Ctrl+S / Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSave]);

  return (
    <div
      className={`fixed inset-0 flex flex-col overflow-hidden ${editorDesignClassNames.surface}`}
    >
      {/* ── Top bar ── */}
      <header
        className={`sticky top-0 z-50 flex h-12 shrink-0 items-center gap-2 px-2 shadow-sm sm:gap-3 sm:px-3 ${editorDesignClassNames.topBar}`}
      >
        <button
          type="button"
          onClick={() => navigate('/editor')}
          className="rounded-md p-1.5 text-[var(--mmp-editor-color-slate)] transition-colors hover:bg-[var(--mmp-editor-color-surface)] hover:text-[var(--mmp-editor-color-charcoal)]"
          aria-label="에디터 목록으로 돌아가기"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="h-5 w-px bg-[var(--mmp-editor-color-hairline)]" />

        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <span className="hidden shrink-0 text-xs text-[var(--mmp-editor-color-steel)] sm:inline">
            에디터
          </span>
          <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-[var(--mmp-editor-color-muted)] sm:block" />
          <span className="truncate text-sm font-semibold text-[var(--mmp-editor-color-charcoal)]">
            {theme.title}
          </span>
          <span
            className={`hidden shrink-0 px-1.5 py-0.5 text-[10px] sm:inline ${editorDesignClassNames.tag}`}
          >
            {STATUS_LABEL[theme.status] ?? theme.status}
          </span>
        </div>

        <div className="hidden sm:block">
          <SaveIndicator status={saveStatus} lastSaved={lastSaved} onRetry={onRetry} />
        </div>

        <div className="hidden h-5 w-px bg-[var(--mmp-editor-color-hairline)] sm:block" />

        <ThemeModeToggle compact ariaLabel="에디터 화면 모드" className="p-0.5" />

        <div className="hidden h-5 w-px bg-[var(--mmp-editor-color-hairline)] sm:block" />

        <button
          type="button"
          onClick={handleValidate}
          className={`h-8 px-2 text-xs transition-colors hover:bg-[var(--mmp-editor-color-surface)] sm:h-7 sm:px-3 ${editorDesignClassNames.secondaryAction}`}
        >
          검증
        </button>
        <button
          type="button"
          onClick={handlePublish}
          disabled={theme.status === 'PUBLISHED' || isPublishing || !onPublish}
          className={`h-8 px-2 text-xs transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 sm:h-7 sm:px-3 ${editorDesignClassNames.primaryAction}`}
        >
          {isPublishing ? '출판 중...' : '출판'}
        </button>
      </header>

      {publishNotice && (
        <div
          role="status"
          className="shrink-0 border-b border-[var(--mmp-editor-color-hairline)] bg-[var(--mmp-editor-color-tint-rose)] px-4 py-2 text-xs text-[var(--mmp-editor-color-error)]"
        >
          {publishNotice}
        </div>
      )}

      {/* ── Tab nav ── */}
      <EditorTabNav themeId={themeId} activeModules={activeModules} forcedVisibleTab={routeTab} />

      {/* ── Validation panel ── */}
      {!dismissed && (validationResult ?? externalWarnings) && (
        <div className="shrink-0 border-b border-[var(--mmp-editor-color-hairline)] px-3 py-2">
          <ValidationPanel
            warnings={validationResult ?? externalWarnings ?? []}
            onClose={() => {
              setValidationResult(null);
              setDismissed(true);
            }}
          />
        </div>
      )}

      {/* ── Content ── */}
      <div
        role="tabpanel"
        id={`tabpanel-${effectiveTab}`}
        aria-labelledby={`tab-${effectiveTab}`}
        className={usesInternalScroll ? 'min-h-0 flex-1 overflow-hidden' : 'flex-1 overflow-y-auto'}
      >
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          }
        >
          <TabContent
            tab={effectiveTab}
            theme={theme}
            themeId={themeId}
            routeSegment={routeSegment}
          />
        </Suspense>
      </div>
    </div>
  );
}

const INTERNAL_SCROLL_TABS = new Set<EditorTab>([
  'storyMap',
  'info',
  'characters',
  'clues',
  'design',
  'questions',
  'endings',
  'locations',
  'media',
]);

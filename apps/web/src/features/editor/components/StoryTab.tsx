import { useState, useMemo, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Columns2, AlignLeft, Eye } from 'lucide-react';
import { useEditorContent, useUpsertContent } from '@/features/editor/api';
import { useFlowGraph } from '@/features/editor/flowApi';
import { useAutoSave } from '@/features/editor/hooks/useAutoSave';
import { toStorySceneFlowSummaryFromGraph } from '@/features/editor/entities/story/storySceneAdapter';
import { StorySceneSummary } from './design/StorySceneSummary';
import { ReadingSectionList } from './reading/ReadingSectionList';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = 'editor' | 'split' | 'preview';

interface StoryTabProps {
  themeId: string;
}

// ---------------------------------------------------------------------------
// View mode toggle button
// ---------------------------------------------------------------------------

interface ViewToggleProps {
  mode: ViewMode;
  current: ViewMode;
  icon: React.ReactNode;
  label: string;
  onClick: (mode: ViewMode) => void;
}

function ViewToggleBtn({ mode, current, icon, label, onClick }: ViewToggleProps) {
  const isActive = mode === current;
  return (
    <button
      type="button"
      onClick={() => onClick(mode)}
      aria-pressed={isActive}
      title={label}
      className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
        isActive
          ? 'bg-slate-800 text-amber-400'
          : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function StorySceneSummaryStatus({ message }: { message: string }) {
  return (
    <div className="border-b border-slate-800 bg-slate-950 px-5 py-4">
      <div className="rounded-sm border border-slate-800 bg-slate-900/45 px-4 py-3 text-xs text-slate-400">
        {message}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StoryTab
// ---------------------------------------------------------------------------

export function StoryTab({ themeId }: StoryTabProps) {
  const { data: contentData } = useEditorContent(themeId, 'story');
  const {
    data: flowGraph,
    isLoading: isFlowLoading,
    isError: isFlowError,
  } = useFlowGraph(themeId);
  const upsertContent = useUpsertContent(themeId, 'story');

  const [markdown, setMarkdown] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('split');

  // Initialize markdown from server data once loaded
  useEffect(() => {
    if (contentData?.body !== undefined) {
      setMarkdown(contentData.body);
    }
  }, [contentData?.body]);

  useAutoSave({
    data: markdown,
    mutationFn: (body) => upsertContent.mutateAsync({ body }),
  });

  const charCount = markdown.length;
  const storySceneSummary = useMemo(() => {
    if (isFlowLoading || isFlowError) return null;
    return toStorySceneFlowSummaryFromGraph(flowGraph);
  }, [flowGraph, isFlowError, isFlowLoading]);

  const previewHtml = useMemo(() => {
    if (!markdown) return '';
    const raw = marked.parse(markdown, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [markdown]);

  const showEditor = viewMode === 'editor' || viewMode === 'split';
  const showPreview = viewMode === 'preview' || viewMode === 'split';

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2">
        <div className="flex items-center gap-1">
          <ViewToggleBtn
            mode="editor"
            current={viewMode}
            icon={<AlignLeft className="h-3.5 w-3.5" />}
            label="에디터만"
            onClick={setViewMode}
          />
          <ViewToggleBtn
            mode="split"
            current={viewMode}
            icon={<Columns2 className="h-3.5 w-3.5" />}
            label="분할"
            onClick={setViewMode}
          />
          <ViewToggleBtn
            mode="preview"
            current={viewMode}
            icon={<Eye className="h-3.5 w-3.5" />}
            label="미리보기만"
            onClick={setViewMode}
          />
        </div>
        <span className="text-[11px] font-mono text-slate-600">
          {charCount.toLocaleString('ko-KR')}자
        </span>
      </div>

      {/* Editor / Preview panes */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {isFlowLoading ? (
          <StorySceneSummaryStatus message="스토리 장면 구성을 불러오는 중입니다." />
        ) : isFlowError ? (
          <StorySceneSummaryStatus message="스토리 장면 구성을 불러오지 못했습니다." />
        ) : storySceneSummary ? (
          <StorySceneSummary summary={storySceneSummary} />
        ) : null}

        <div className="flex min-h-[40vh] flex-col lg:flex-row">
          {/* Editor pane */}
          {showEditor && (
            <div className={`flex min-h-[32vh] flex-col ${viewMode === 'split' ? 'lg:w-1/2 lg:border-r lg:border-slate-800' : 'w-full'}`}>
              <textarea
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                placeholder="마크다운으로 스토리를 작성하세요..."
                spellCheck={false}
                className="flex-1 resize-none bg-slate-950 px-5 py-4 font-mono text-sm leading-relaxed text-slate-300 caret-amber-500 selection:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-inset"
              />
            </div>
          )}

          {/* Preview pane */}
          {showPreview && (
            <div className={`min-h-[32vh] overflow-y-auto ${viewMode === 'split' ? 'border-t border-slate-800 lg:w-1/2 lg:border-t-0' : 'w-full'}`}>
              {previewHtml ? (
                <div
                  className="prose prose-invert prose-sm prose-headings:font-mono prose-strong:text-amber-400 max-w-none px-5 py-4"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <div className="flex items-center justify-center py-20 text-xs font-mono uppercase tracking-widest text-slate-700">
                  미리보기 없음
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reading sections — Phase 7.7 */}
        <div className="border-t border-slate-800 px-5 py-6">
          <ReadingSectionList themeId={themeId} />
        </div>
      </div>
    </div>
  );
}

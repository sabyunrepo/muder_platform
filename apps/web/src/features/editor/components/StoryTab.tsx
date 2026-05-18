import { MessageSquareText } from 'lucide-react';
import { ReadingSectionList } from './reading/ReadingSectionList';

interface StoryTabProps {
  themeId: string;
}

// ---------------------------------------------------------------------------
// StoryTab
// ---------------------------------------------------------------------------

export function StoryTab({ themeId }: StoryTabProps) {
  return (
    <div className="min-h-full bg-[var(--mmp-editor-color-surface-soft)]">
      <header className="border-b border-[var(--mmp-editor-color-hairline)] px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--mmp-editor-color-primary)]">
              <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
              읽기 대사
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--mmp-editor-color-charcoal)]">
              장면에서 읽거나 들려줄 대사 묶음
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--mmp-editor-color-slate)]">
              오프닝 낭독, 장면 지문, 엔딩 멘트처럼 플레이 중 진행될 대사와 음성, BGM, 진행 방식을
              관리합니다. 장면 배치는 스토리 진행 화면의 장면 설정에서 연결합니다.
            </p>
          </div>
          <div className="w-fit rounded border border-[var(--mmp-editor-color-hairline)] bg-[var(--mmp-editor-color-canvas)] px-3 py-2 text-xs text-[var(--mmp-editor-color-slate)]">
            <p className="text-[10px] text-[var(--mmp-editor-color-muted)]">연결 위치</p>
            <p className="mt-0.5 text-[var(--mmp-editor-color-charcoal)]">스토리 진행 · 장면 설정</p>
          </div>
        </div>
      </header>

      <main className="px-5 py-6">
        <ReadingSectionList themeId={themeId} />
      </main>
    </div>
  );
}

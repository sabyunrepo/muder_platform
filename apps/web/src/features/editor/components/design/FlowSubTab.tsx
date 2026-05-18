import { FlowCanvas } from './FlowCanvas';

interface FlowSubTabProps {
  themeId: string;
}

export function FlowSubTab({ themeId }: FlowSubTabProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--mmp-editor-color-surface-soft)]">
      <header className="shrink-0 border-b border-[var(--mmp-editor-color-hairline)] bg-[var(--mmp-editor-color-canvas)] px-4 py-3 lg:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--mmp-editor-color-primary)]">
          스토리 제작
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--mmp-editor-color-charcoal)]">
          장면 흐름
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--mmp-editor-color-slate)]">
          장면은 게임 진행 순서를 화살표로 연결합니다. 장면을 선택하면 아래 또는 오른쪽에서 정보 공개와 시작/종료 실행을 편집할 수 있습니다.
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <FlowCanvas themeId={themeId} />
      </div>
    </div>
  );
}

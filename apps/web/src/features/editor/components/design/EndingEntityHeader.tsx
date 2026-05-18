import { editorDesignClassNames } from "@/features/editor/design-system/editorDesignTokens";

export function EndingEntityHeader() {
  return (
    <header className={`p-4 ${editorDesignClassNames.panel}`}>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase text-[var(--mmp-editor-color-primary)]">결말 편집</p>
        <h2 className="text-xl font-semibold text-[var(--mmp-editor-color-charcoal)]">결말 목록</h2>
        <p className="max-w-3xl text-sm leading-6 text-[var(--mmp-editor-color-slate)]">
          Flow의 엔딩 노드를 결말 목록으로 모아 보여줍니다. 게임 종료 시 서버가 투표·질문·조건 결과를 판정하고,
          이곳에서는 플레이어에게 공개될 결말 이름과 본문을 정리합니다.
        </p>
      </div>
    </header>
  );
}

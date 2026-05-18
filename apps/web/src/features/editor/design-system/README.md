# Editor Design System Boundary

이 폴더는 `DESIGN.md`의 Notion-inspired 토큰을 MMP 에디터 안에서만 쓰기 위한 경계입니다.

## 고정 결정

- `DESIGN.md` 원본은 repo root에 보존한다.
- 실제 스타일 적용은 `EditorPage`의 `mmp-editor-design-scope` wrapper 아래에서만 한다.
- Tailwind 전역 `@theme`, `body`, `:root`, shared UI 컴포넌트에는 Notion 토큰을 직접 주입하지 않는다.
- 후속 에디터 재설계는 이 폴더의 CSS 변수와 class name helper를 우선 사용한다.

## 원안 대비 조정

- `DESIGN.md`의 marketing hero, pricing, decorative mesh/wire 패턴은 에디터 운영 UI에는 바로 적용하지 않는다.
- display typography의 negative letter-spacing은 repo 지침과 충돌하므로 후속 화면 적용 때 0으로 보정한다.
- pastel cards는 정보 구분용 보조 tint로만 사용하고, 기능 카드 남발은 피한다.
- 색상은 project-wide `--mmp-color-*` semantic token을 바라보는 alias로 둔다.
- 에디터만의 radius, spacing, shadow, density는 `--mmp-editor-*` namespace로 유지한다.
- `data-editor-theme`는 scoped guard와 테스트 경계이며 실제 색상 source of truth는 `html[data-theme]`다.

## 사용 방법

```tsx
import { editorDesignClassNames } from "@/features/editor/design-system/editorDesignTokens";

<section className={editorDesignClassNames.panel}>...</section>;
```

새 에디터 UI를 만들 때는 먼저 `mmp-editor-design-scope` 아래에 있는지 확인한다. 이 wrapper 밖에서 위 class를 사용하면 의도한 토큰이 적용되지 않아야 정상이다.

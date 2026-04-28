---
name: tdd-mmp-react
description: |
  React 새 .tsx 컴포넌트 작성 시 .test.tsx가 없으면 TDD soft ask로 테스트를 먼저 만들도록 안내.
  자동 활성화 트리거: "React 컴포넌트 만들어", ".tsx 작성", "Vitest", "RTL", "MSW", "user-event",
  "components/", "pages/", "hooks/", apps/web/src/ 하위 .tsx 파일 작성, 새 페이지·컴포넌트 도입.
  Soft ask 모드 — N 응답으로 진행 허용 (types/constants 예외).
  Vitest + React Testing Library + MSW 패턴 카논(apps/web/CLAUDE.md) 인용.
---

# tdd-mmp-react — React TDD Soft Ask

## 정책 요약

- **트리거**: 새 `.tsx` 파일 작성 시도 (Write tool, file_path가 `apps/web/src/.../*.tsx`).
- **검사**: 동일 디렉토리 `<base>.test.tsx` / `__tests__/<base>.test.tsx` / 부모 `__tests__/<base>.test.tsx` 존재.
- **부재 시 동작**: PreToolUse hook이 `permissionDecision: "ask"` JSON 출력.
- **N 응답**: 진행 허용. 4-agent test-engineer가 PR review 시 P2 coverage 경고 가능.

카논 root: `.claude/plugins/compound-mmp/refs/tdd-enforcement.md`.

## 자동 통과 예외

> **Single source of truth**: `hooks/pre-edit-size-check.sh` § "자동 통과 예외" case 블록. 아래 표는 참조용 사본 — drift 발견 시 hook이 master.

| 패턴 | 이유 |
|------|------|
| `*.test.tsx`, `*.test.ts` | 본인이 테스트 |
| `apps/web/src/types/*` | 순수 타입 선언 |
| `apps/web/src/constants/*` | 상수만 |

## React 코드 룰 (apps/web/CLAUDE.md 카논)

테스트 스택 권장:
1. **Vitest** — Jest 대신 Vitest (Vite-native, ESM, TypeScript first).
2. **React Testing Library** — `@testing-library/react` + `@testing-library/user-event`. queryBy/findBy 우선, getBy는 예외.
3. **MSW** — `msw/node` 로 API 모의. 직접 fetch mock 금지.
4. **vitest browser mode** (앞으로) — DOM 접근이 필요한 컴포넌트는 jsdom 대신 Browser Mode 검토.

> 글로벌 override 적용 안 됨: 이 프로젝트는 Tailwind 4 직접 사용 — Seed Design 3단계 룰 미적용 (CLAUDE.md 명시).

## 파일 시그니처 예시

```tsx
// apps/web/src/components/Button.tsx (신규)
import { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export function Button({ variant = 'primary', ...rest }: ButtonProps) {
  return <button data-variant={variant} {...rest} />;
}
```

```tsx
// apps/web/src/components/Button.test.tsx (먼저 작성 권장)
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders with primary variant by default', () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole('button', { name: 'Click' })).toHaveAttribute('data-variant', 'primary');
  });

  it('triggers onClick handler', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

## __tests__ 디렉토리 패턴

apps/web/src 하위에서 두 패턴 모두 자동 통과 처리:
- 동일 디렉토리: `components/Button.tsx` + `components/Button.test.tsx`
- `__tests__` 서브: `components/Button.tsx` + `components/__tests__/Button.test.tsx`
- 부모 `__tests__` (legacy): `components/Button.tsx` + `__tests__/Button.test.tsx`

## N 응답 사유 명시

PR description에 한 줄 명시:
- "N 응답: page-level 컴포넌트 (E2E Playwright로 커버)"
- "N 응답: 순수 presentational 컴포넌트 (시각 회귀로 커버)"

## 카논 ref

- TDD 정책 근거: `refs/tdd-enforcement.md`
- React 코드 룰: `apps/web/CLAUDE.md`
- 4-agent 매핑: `refs/post-task-pipeline-bridge.md`
- Anti-patterns: `refs/anti-patterns.md`

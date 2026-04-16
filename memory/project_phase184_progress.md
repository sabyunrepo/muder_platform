---
name: Phase 18.4 완료 — 에디터 UX Bugfix
description: 9 증상 회귀/미구현 일괄 해소. 7 PR + 2 hotfix, 4 Wave. 골든패스 복구.
type: progress
---

# Phase 18.4 — 에디터 UX Bugfix 완료

## 범위 (2026-04-15)

- 7 PR + 2 hotfix + 1 docs
- 4 Wave (W0 backend × 2, W1 frontend × 2 + 2 hotfix, W2 UX × 2 + 1 hotfix, W3 E2E + docs)
- 테스트: ~420+ editor vitest, Go testcontainers (CI), Playwright 9 스텁드 시나리오
- 워크트리: claude/cranky-bartik (r-20260415-205940-f535)

## PR 요약

| PR | 커밋 | 내용 |
|----|------|------|
| PR-1 | 848f458 | `/templates` 라우트 등록 + handler 테스트 |
| PR-2 | d5e318b | clue-relations 빈 결과 200 + config 409 current_version |
| W0-hotfix | cd4a3a9 | TemplateHandler AppError + RFC 9457 마이그레이션 |
| PR-3 | cb1c394 | upload-url 경로 + clue image cache sync |
| PR-4 | 6bd6d01 | config 409 silent rebase + retry + Snackbar |
| W1-hotfix-1 | baeea29 | ClueForm 481→4 파일 분할 + CluesTab mock 수정 |
| W1-hotfix-2 | 8125566 | config 409 rebase 의미론 문서화 |
| PR-5 | 0ad006d | optimistic update + debounce 1500ms + onBlur flush |
| PR-6 | 9b800ff | LocationClueAssignPanel + locations[].clueIds |
| W2-hotfix | 05fa426 | CharacterAssignPanel debounce multi-key edit 병합 |
| PR-7 | — (현 커밋) | E2E 9 시나리오 + 회귀 + 문서 + memory |

## 해결된 9 증상 (design.md 매트릭스)

| # | 증상 | PR | 근본 원인 |
|---|------|----|----------|
| 1 | upload-url 404 | PR-3 | 프론트 baseURL 중복 합성 |
| 2 | 체크 지연 | PR-5 | React Query optimistic update 부재 |
| 3 | 잦은 저장 | PR-5 | Config 폼 debounce 500ms |
| 4 | 이미지 지연 | PR-3 | uploadImage 후 invalidate 타이밍 앞섬 |
| 5 | clue-relations 500 | PR-2 | ErrNoRows 미처리 |
| 6 | config 409 | PR-2/PR-4 | cached version mismatch + silent rebase 없음 |
| 7 | flow/nodes 405 | (기계약) | 프론트 PUT → PATCH (W1 패치로 정리) |
| 8 | 배치 UI 없음 | PR-6 | LocationClueAssignPanel 미구현 |
| 9 | templates 404 | PR-1 | main.go 라우트 미등록 |

## 테스트 결과

### Frontend vitest
- 누적 ~420+ editor 테스트 그린 (PR-3~PR-6 누적)
- 회귀: `pnpm test --filter=@mmp/web` — 그린 유지

### Backend Go
- `go test -race ./internal/domain/editor/... ./cmd/server/...` — PR-1, PR-2 그린
- testcontainers 계열은 Docker 환경 필요 — CI에서 게이트

### E2E (새로 추가)
- `apps/web/e2e/editor-golden-path.spec.ts` — 9 시나리오
- `apps/web/e2e/helpers/editor-golden-path-fixtures.ts` — 공용 mock fixtures
- 실행: stubbed-backend CI job (Phase 18.3 L-8 인프라)
- 로컬 실행은 `PLAYWRIGHT_BACKEND=0 pnpm -F @mmp/web test:e2e editor-golden-path`

## Learnings

### 🔴 `http.Error` 재등장 경보
- W0-hotfix 에서 TemplateHandler 가 `http.Error` 로 응답하고 있어 RFC 9457 정책 위반이었음.
- 코딩 규칙 보강 필요: PR 리뷰 체크리스트에 `grep -n "http.Error" apps/server` 자동 스캔 추가 제안.

### 🔴 파일 한도 누적 경보
- ClueForm 481줄 — TS 400 한도 초과. W1-hotfix-1 에서 4 파일 분할.
- 초과 전 설계 단계에서 쪼개기 설계를 의무화해야 함 (mmp-200-line-rule 스킬 강제 활용).

### Optimistic update 중복
- PR-5 / PR-6 / W2-hotfix 에서 각각 비슷한 onMutate/onError/onSettled 보일러를 작성.
- 공용 `useDebouncedMutation` 훅으로 추출하는 리팩터 PR 을 Phase 18.5 후보로 제안.

### Config 409 rebase 의미론
- 현재는 서버 `current_version` 만 교체하는 force overwrite. 동시 편집 시 뒤 세션이 이김.
- 3-way merge 는 UX 복잡도 때문에 보류. W1-hotfix-2 에서 문서화 (`refs/config-409-rebase-semantics.md`).

## 후속 과제 (Phase 18.5 후보 or refactor PR)

- [ ] `useDebouncedMutation` 공용 훅 추출 (PR-5/6/W2-hotfix 중복 제거)
- [ ] PhaseNodePanel / ModulesSubTab 네이티브 HTML → @jittda/ui 마이그레이션
- [ ] config 409 3-way merge UX (현재는 force overwrite, 동시편집 사용자 경고 부재)
- [ ] LocationClueAssignPanel optimistic + rollback (현재 낙관 반영만)
- [ ] 런타임 단서 발견 조건 연결 (locations[].clueIds → GameEngine 노출)
- [ ] `http.Error` 금지 lint rule (CI-level)

## 관련 문서

- 플랜: `docs/plans/2026-04-15-editor-ux-bugfix/` (design/plan/checklist + refs)
- 런 아티팩트: `.claude/runs/r-20260415-205940-f535/`
- E2E 스펙: `apps/web/e2e/editor-golden-path.spec.ts` + `helpers/editor-golden-path-fixtures.ts`

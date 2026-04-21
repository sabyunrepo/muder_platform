---
name: Phase 18.4 에디터 UX Bugfix 완료
description: 에디터 저작 골든패스 복구 — 9 버그 + 3 hotfix + E2E, 2026-04-15 단일일 완료
type: project
---
# Phase 18.4 — 에디터 UX Bugfix 완료

## 요약
- **완료일**: 2026-04-15
- **기간**: 단일일 (brainstorm 포함 약 6시간, autopilot wave 실행)
- **Final commit**: `9648934` (archive)
- **규모**: 7 PR + 3 hotfix, 4 Wave (W0 backend×2, W1 frontend×2, W2 UX×2, W3 E2E)
- **테스트**: 423 editor vitest + 9 Playwright E2E 시나리오

## 해결된 9 버그
1. `POST /editor/themes/{id}/images/upload-url` 404 — baseURL 2중 합성 (PR-3)
2. 캐릭터 배정탭 시작 단서 체크 한박자 지연 — optimistic setQueryData (PR-5)
3. 글자 하나마다 저장 — debounce 500 → 1500ms + onBlur flush (PR-5)
4. 단서 등록 후 이미지 즉시 미표시 — setQueryData merge + invalidate (PR-3)
5. `GET /editor/themes/{id}/clue-relations` 500 — pgx.ErrNoRows 빈 배열 처리 (PR-2)
6. `PUT /editor/themes/{id}/config` 409 — RFC 9457 extensions.current_version + 프론트 silent rebase 1회 재시도 (PR-2 + PR-4)
7. `PUT /editor/themes/{id}/flow/nodes/{nodeId}` 405 — 프론트 PATCH로 전환 (PR-1 유지 / 프론트 후속)
8. 장소탭에 "맵 + 단서 배치" UI 없음 — LocationClueAssignPanel + `locations[].clueIds` schema (PR-6)
9. `GET /api/v1/templates` 404 — main.go 라우트 등록 (PR-1)

## Hotfix (advisor 리뷰에서 도출)
- **W0 M-2**: `TemplateHandler` http.Error → `apperror.WriteError` 마이그레이션 (RFC 9457 규칙 위반 복구, Sentry/trace 파이프라인 복구)
- **W1 H-1**: `ClueForm.tsx` 481줄 분할 → 4파일 (Advanced/Image/Submit hook)
- **W1 H-2**: config 409 "silent rebase" 의미론 명시 문서화 (실제로는 force overwrite — Phase 18.5 3-way merge 후속)
- **W2 H-W2-1**: `CharacterAssignPanel.pendingRef` stale basis 버그 (debounce 창 내 multi-key 편집 시 이전 업데이트 유실)

## Wave 구조
```
W0 backend parallel ×2 → W1 frontend parallel ×2 → W2 UX parallel ×2 → W3 E2E sequential
```

- W0 PR-1: templates route + handler test
- W0 PR-2: clue-relations empty + config 409 current_version
- W1 PR-3: upload-url path + clue image cache sync
- W1 PR-4: config 409 silent rebase + Snackbar
- W2 PR-5: optimistic update + debounce 1500ms + onBlur flush
- W2 PR-6: LocationClueAssignPanel + `locations[].clueIds`
- W3 PR-7: Playwright E2E 9 시나리오 + progress docs + memory

## 주요 Learnings
- **`http.Error` 재등장 경보** — AppError/RFC 9457 규칙을 코딩 가이드에 금지 룰로 명시 필요
- **파일 한도 누적 경보** — ClueForm 474줄(Phase 17) → 481(18.4). PR마다 +몇 줄이 누적되면 한도 돌파. 티어 초과 진입 시 분할 필수 정책 필요
- **Optimistic + debounce + rollback 3종 세트** — 양쪽 패널에서 수동 useRef 보일러플레이트 복제. `useDebouncedMutation` 공용 훅 추출 Phase 18.5 필수 과제

## 후속 과제 (Phase 18.5 후보)
- `useDebouncedMutation` 공용 훅 + 기존 6+ consumer 통합
- `PhaseNodePanel` / `ModulesSubTab` 네이티브 HTML (input/select/button[role=switch]) → `@jittda/ui` 마이그레이션
- Config 409 3-way merge 의미론 (현재는 force overwrite, 동시 다중 탭에서 타인 변경을 조용히 덮음)
- `LocationClueAssignPanel` optimistic + rollback
- Feature flag `location_clue_assignment_v2` — 런타임 엔진 소비 시점 게이트

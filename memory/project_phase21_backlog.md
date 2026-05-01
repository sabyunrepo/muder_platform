---
name: Phase 21 Backlog
description: Phase 19/22/23 종료 후 잔여 follow-up 항목 통합 backlog. Phase 19 W4 완료 후 우선순위 재평가.
type: project
---
# Phase 21 — Backlog (이월 follow-up 통합)

> 본 파일은 종료된 phase에서 backlog로 이월된 항목의 단일 인덱스. Phase 19 W4 완료 후 우선순위 재평가 + 별도 phase로 분기 결정.

**작성일**: 2026-04-30 (Phase 22 W1.5 + Phase 23 archive 시점)

---

## 인프라 follow-ups (Phase 23 — Closed 2026-05-01)

**Closed (2026-05-01) — superseded by KT Cloud KS arc-runner-set 진화 (PR #179/#180).**
사용자 결정: Phase 23 Custom Runner Image 라인 자체를 종료. main이 KT Cloud KS ARC로 진화하면서 `build-runner-image.yml` / `infra/runners/Dockerfile` 자체가 obsolete 경로로 진입. P0-1 chicken-egg / P1-4 Composite action / P1-5 govulncheck pin / P1-6 ubuntu builder SHA pin / P1-7 ARG DOCKER_GID 5건 모두 backlog에서 영구 제거.

P0-2 (GHCR repo connection)은 사용자 manual 1회 작업으로 이미 해소.

근거: `docs/plans/2026-04-29-phase-23-custom-runner-image/checklist.md` follow_ups 섹션 + 사용자 결정 2026-05-01 (option a).

---

## 보안 follow-ups (Phase 19 audit log orphan actions)

Phase 19 Residual PR-6 (auditlog expansion) 진행 중 발견 — 5 action 상수가 wire-up 대상 엔드포인트 부재로 orphan 상태. 별 phase로 vertical 분리 권장.

| ID | 항목 | 도메인 | 비고 |
|----|------|--------|------|
| O-1 | `ActionUserPasswordChange` | auth | `auth.ChangePassword` 엔드포인트 신설 필요 |
| O-2 | `ActionAdminBan` / `ActionAdminUnban` | admin | ban/unban 라이프사이클 부재 |
| O-3 | `ActionEditorClueEdgeCreate` / `ActionEditorClueEdgeDelete` | editor | 개별 CRUD 부재 (Replace만 존재) |
| O-4 | `ActionEditorClueRelationCreate` / `ActionEditorClueRelationDelete` | editor | `clue_relation_*.go` 파일 전무 |

권장 분기: Ban/Unban lifecycle + Password Change + Clue Graph 개별 CRUD 5개 vertical 독립 PR.

근거: `memory/project_phase19_residual_progress.md` W1 PR-6 "Orphan action 상수 7건 → Phase 21 후보" 섹션.

---

## 에디터 리팩터 후보 (Phase 24 후보 — 별도 brainstorm 필요)

Phase 18.4/18.5 종료 시 명시된 잔여 에디터 부채. Phase 19 W4 완료 후 brainstorm 진입.

**2026-04-30 검증**: 6 항목 현황 점검 결과 E-2는 프로젝트 룰 충돌로 **무효**, E-4는 **이미 해소** 확인. 실제 미해결 4건 (E-1 / E-3 / E-5 / E-6).

**2026-05-01 추가**: Wave 1 PR #184 (E-1 + E-6) 머지 후 4-agent + CodeRabbit round-2/3 리뷰에서 추가 follow-up 항목 6건 식별 (E-7 ~ E-12). 모두 LOW/MEDIUM, scope creep 회피 위해 별도 PR로 분리.

| ID | 항목 | 영역 | 규모 | 상태 |
|----|------|------|------|------|
| ~~E-1~~ | ~~`useDebouncedMutation` 공용 훅 + 3 consumer 통합~~ | — | — | **해소 (2026-05-01, PR #184)** |
| ~~E-2~~ | ~~`PhaseNodePanel` / `ModulesSubTab` → `@jittda/ui` 마이그레이션~~ | — | — | **무효 (2026-04-30)** |
| E-3 | Config 409 **3-way merge** 의미론 | 백엔드+프론트 | L+ (별도 brainstorm 필수) | 미해결 |
| ~~E-4~~ | ~~`LocationClueAssignPanel` optimistic + rollback~~ | — | — | **해소 (2026-04-30)** |
| E-5 | `location_clue_assignment_v2` feature flag (런타임 엔진 소비 게이트) | 프론트+런타임 | S | 미해결 |
| ~~E-6~~ | ~~파일 크기 누적 가드 (PR마다 +수줄 누적 정책)~~ | — | — | **해소 (2026-05-01, PR #184 file-size-guard.yml warn-only)** |
| E-7 | `PhaseNodePanel` 서브컴포넌트 분리 (PhaseBasicInfo / PhaseTimerSettings / PhaseAdvanceToggle) — JSX 컴포넌트 150줄 룰 충족 | 프론트 리팩터 | M | 미해결 (CR-3) |
| E-8 | `CharacterAssignPanel` 분리 (CharacterList + `useCharacterConfigDebounce` hook) — JSX 150줄 룰 + 책임 분리 | 프론트 리팩터 | M | 미해결 (CR-4) |
| E-9 | `file-size-guard.yml` glob 패턴 정정 (`**/dist/**` → `*/dist/*`, `*/internal/*/mocks/*` 한정, `*.pb.go` / `*.gen.go` 추가) | 인프라 | S | 미해결 (round-2 arch M-1/M-2) |
| E-10 | `useDebouncedMutation` `FlushRefs` bag 단순화 — 2 caller만 있으면 inline closure가 더 readable (YAGNI) | 프론트 리팩터 | XS | 미해결 (round-2 arch LOW) |
| E-11 | `useDebouncedMutation` `useUnmountFlush` inline — 단일 호출 helper, inline 가능 | 프론트 리팩터 | XS | 미해결 (round-2 arch LOW) |
| E-12 | `useDebouncedMutation` 추가 회귀 테스트 — schedule×2 windows / 재진입 contract / EndingNodePanel unmount-during-pending | 테스트 보강 | S | 미해결 (round-2 test LOW) |

### E-2 무효 사유

`apps/web/CLAUDE.md` L3 명시: **"Tailwind 4 직접 사용, 디자인 시스템 라이브러리 의존 없음. 글로벌 ~/.claude/CLAUDE.md 의 Seed Design 3단계 규칙은 이 프로젝트에 적용되지 않는다."** Phase 18.4 후속 과제로 등록될 당시 글로벌 룰을 잘못 적용한 항목. backlog에서 영구 제거.

### E-4 해소 근거

`apps/web/src/features/editor/components/design/LocationClueAssignPanel.tsx:62-82` — `queryClient.setQueryData` optimistic write + `previous` 캡처 + `onError` 롤백 + Sonner toast 완비. 커밋 시점 미상이나 현재 main 기준 완전 구현. backlog 종료.

### E-1 해소 근거 (2026-05-01, PR #184)

`apps/web/src/hooks/useDebouncedMutation.ts` (213 LOC) — debounce timer + pending body + optimistic apply + rollback closure + onBlur flush + unmount cleanup 캡슐화. 함수 분리 (`flushMutation` / `schedulePending` / `clearTimer` / `useUnmountFlush`) 로 60줄 룰 충족. 14 테스트 케이스 (TDD). 3 consumer 마이그레이션 + EndingNodePanel은 PhaseNodePanel 수준으로 동등화 (optimistic + rollback + onBlur flush 추가).

round-2/3에서 4-agent + CodeRabbit 발견 9건 in-PR 해소 (perf-H1/H2, arch-H1/H2, test-H1/H2, CR-1, CR-2, N-1/N-2). 잔여 LOW/MEDIUM 6건은 E-7~E-12로 이월.

### E-6 해소 근거 (2026-05-01, PR #184)

`.github/workflows/file-size-guard.yml` — PR diff 변경 파일을 `git diff --name-only --diff-filter=AMR`로 추출, 유형별 한도 (Go 500 / TS·TSX 400 / MD 500 / CLAUDE.md 200) 위반 시 `::warning::` + Step Summary 출력. warn-only (실제 차단 X). 자동 생성물 (sqlc/mockgen/dist) 예외. AMR로 rename 우회 차단.

근거: `memory/project_phase184_progress.md` "후속 과제 (Phase 18.5 후보)" + Phase 18.5 종료 시점 미해소 항목 + 2026-04-30 / 2026-05-01 검증.

---

## 우선순위 재평가 시점

- **Phase 19 W4 완료 직후**: 본 backlog 전수 재평가
- **인프라 P0-1**: KT Cloud KS arc-runner-set 진화로 자연 해소되면 close — 별도 verify 필요
- **에디터 E-3**: 단독 phase로 분기 (3-way merge는 git-style 충돌 해소 알고리즘 도입이라 별도 brainstorm 필수)
- **에디터 E-7/E-8**: 병합 가능. CharacterAssignPanel + PhaseNodePanel 분리는 하나의 "에디터 컴포넌트 분리" PR로 묶을 수 있음. JSX 150줄 룰 충족 + `useCharacterConfigDebounce` 훅 추출 동시 진행.
- **에디터 E-10/E-11**: 같은 파일 (`useDebouncedMutation.ts`) 내부 정리. 한 PR로 묶음 권장 (XS+XS).

---

## 인덱스 갱신

본 파일이 갱신되거나 항목이 별 phase로 분기되면 `memory/MEMORY.md` Backlog 섹션도 동기화.

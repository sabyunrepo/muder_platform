---
name: Phase 21 Backlog
description: Phase 19/22/23 종료 후 잔여 follow-up 항목 통합 backlog. Phase 19 W4 완료 후 우선순위 재평가.
type: project
---
# Phase 21 — Backlog (이월 follow-up 통합)

> 본 파일은 종료된 phase에서 backlog로 이월된 항목의 단일 인덱스. Phase 19 W4 완료 후 우선순위 재평가 + 별도 phase로 분기 결정.

**작성일**: 2026-04-30 (Phase 22 W1.5 + Phase 23 archive 시점)

---

## 인프라 follow-ups (Phase 23 이월)

| ID | 항목 | 우선순위 | 위치 | 비고 |
|----|------|----------|------|------|
| P0-1 | chicken-egg fix `runs-on: ubuntu-latest` | High | `.github/workflows/build-runner-image.yml` | 사용자 host fallback 작동 중. main이 KT Cloud KS arc-runner-set로 진화하면서 자연 해소 가능성 — 재평가 필요 |
| P1-4 | Composite action 추출 | Med | `.github/actions/start-services/action.yml` (신규) | 9 workflow 중복 제거 |
| P1-5 | govulncheck version pin | Med | `.github/workflows/build-runner-image.yml` | `@latest` → SHA pin |
| P1-6 | ubuntu builder SHA pin | Med | `infra/runners/Dockerfile` | builder stage `ubuntu:22.04` SHA pin |
| P1-7 | ARG DOCKER_GID | Low | `infra/runners/Dockerfile` | hardcoded 990 → ARG |

P0-2 (GHCR repo connection)은 사용자 manual 1회 작업으로 이미 해소 — backlog 제외.

근거: `docs/plans/2026-04-29-phase-23-custom-runner-image/checklist.md` follow_ups 섹션.

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

| ID | 항목 | 영역 | 규모 |
|----|------|------|------|
| E-1 | `useDebouncedMutation` 공용 훅 + 6+ consumer 통합 | 프론트 리팩터 | M |
| E-2 | `PhaseNodePanel` / `ModulesSubTab` → `@jittda/ui` 마이그레이션 | 프론트 디자인 시스템 | M |
| E-3 | Config 409 **3-way merge** 의미론 | 백엔드+프론트 | L+ (별도 brainstorm 필수) |
| E-4 | `LocationClueAssignPanel` optimistic + rollback | 프론트 | S |
| E-5 | `location_clue_assignment_v2` feature flag (런타임 엔진 소비 게이트) | 프론트+런타임 | S |
| E-6 | 파일 크기 누적 가드 (PR마다 +수줄 누적 정책) | 코딩 가이드 | S |

근거: `memory/project_phase184_progress.md` "후속 과제 (Phase 18.5 후보)" + Phase 18.5 종료 시점 미해소 항목.

---

## 우선순위 재평가 시점

- **Phase 19 W4 완료 직후**: 본 backlog 전수 재평가
- **인프라 P0-1**: KT Cloud KS arc-runner-set 진화로 자연 해소되면 close — 별도 verify 필요
- **에디터 E-3**: 단독 phase로 분기 (3-way merge는 git-style 충돌 해소 알고리즘 도입이라 별도 brainstorm 필수)

---

## 인덱스 갱신

본 파일이 갱신되거나 항목이 별 phase로 분기되면 `memory/MEMORY.md` Backlog 섹션도 동기화.

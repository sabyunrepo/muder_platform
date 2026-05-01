---
name: PR 리뷰 / acceptance gate 검증 사전 체크리스트
description: PR 마무리 단계 (4-agent 리뷰 또는 manual E2E) 진입 전 미리 확인할 4 axis. PR-9 (2026-05-01) 회고 — BLOCKER 1 + HIGH 4 가 본 체크리스트 항목으로 모두 사전 catch 가능했음
type: feedback
---

# PR 리뷰 / acceptance gate 사전 체크리스트

PR 의 worktree commit chain 을 마무리하고 4-agent 리뷰 또는 manual E2E 에 들어가기 *전*, 아래 4 axis 를 self-check. 본 체크리스트는 PR-9 (2026-05-01) 의 BLOCKER 1 + HIGH 4 를 모두 *사전* 에 잡을 수 있었던 항목들.

## 발동 트리거

- 코딩 task chain (Task 3.1~3.6, Task 4~6 같은 sub-task 분해 작업) 의 *마지막 commit* 직후
- `/compound-review` 또는 manual E2E 진입 *직전*
- PR cover letter 작성 직전

## Axis 1 — Wire format / catalog ↔ 구현 일치

신규 wire (WS envelope, HTTP route, gRPC method 등) 추가 시 *catalog 또는 spec 파일* 의 표기와 *handler / 호출처* 의 표기가 정확히 같은지.

**why**: PR-9 Task 3.2 에서 reading_handler 의 colon-form (`reading:advance`) 만 보고 카논 가정. 그러나 catalog (envelope_catalog_system.go) + 자동 생성 TS WsEventType 는 dot-form (`auth.identify`). retro fix commit `f58eb46` 가 Type 상수 8 + main.go 3 entries 정렬 필요했음.

**how to apply**:
- 신규 envelope 추가 시 `grep "<eventName>" packages/shared/src/ws/types.generated.ts` 로 자동 생성 결과 확인
- catalog entry 의 `Type:` 필드 string 과 코드의 const string 이 *byte-for-byte* 같은지
- router.Handle 의 첫 인자가 namespace 인지 full type 인지 (router.Route 의 split 동작 확인)
- Phase 19 audit F-ws-* 의 dot/colon 부조화 노트 참조

## Axis 2 — Spec comment / migration comment 와 구현 일치

migration SQL 의 `-- comment` 또는 spec doc 의 자연어 명세가 정확하다면, 구현이 그 명세를 정확히 honour 하는지 *코드 레벨* 검증.

**why**: PR-9 BLOCKER (auth_protocol.go:275) — migration 00027 의 SQL comment 는 "newer than the connection's auth timestamp as `since`" 라고 정확히 명시. 그러나 구현은 `time.Time{}` (epoch 0) 전달 → user 의 *모든* 과거 revoke 매치 → mass user lockout. unit test 도 zero TTL 의미 매치만 검증해 missed. 4-agent 리뷰 (perf + security 동시) 에서야 발견.

**how to apply**:
- 신규 sqlc query 작성 시 SQL comment / migration comment 를 *spec ground truth* 로 취급
- 구현 시 comment 의 모든 "필수 조건" 절을 코드에서 실제 만족하는지 line-by-line 매핑
- 단위 테스트가 *spec 의 의미* 가 아니라 *현재 구현 의 동작* 만 검증하지 않는지 (regression test 가 spec violation 을 catch 하는지)
- 위반 시 review checklist 의 1순위 — production blocker 가능성 높음

## Axis 3 — Cross-component 회로 검증은 manual E2E 가 단일 신뢰

**why**: PR-9 Task 3.6 commit 시 "social Hub publisher follow-up" 으로 명시. unit test 다 통과 (Go 29 + TS 14). 그러나 manual E2E 가 *진짜 acceptance gate* 검증 시 social close 자체가 안 됨을 폭로 → SocialHub.RevokePublisher 신규 + main.go composite + socialRouter 등록 (commit `204e413`) 필요했음.

**how to apply**:
- 다중 component (game + social Hub, multiple publisher, multiple service) 회로는 unit test 만으로 회로 완결성 검증 X
- *manual E2E 한 번 실행* 이 acceptance gate 의 ground truth — unit 100% 통과 ≠ acceptance 통과
- E2E 실패 시 발견되는 결함은 *unit test 가 mock 으로 우회한 layer* 의 누락. 정확히 그 layer 의 wire 를 추가해야
- "follow-up" 으로 미루지 말 것 — acceptance gate 가 의존하는 회로면 본 PR scope

## Axis 4 — Test fixture 격리 (workers=N 시 false positive)

동일 fixture user / shared resource 사용하는 spec 은 default parallel mode 에서 false positive 가능.

**why**: PR-9 Task 6 첫 manual E2E 시 시나리오 1 이 1.1s "PASS" — 실은 시나리오 2 의 second register 가 SocialHub single-session enforcement 로 첫 번째 socket 을 silent close 한 것. 진짜 PR-9 push 가 아닌 부수효과로 close. workers=2 false positive.

**how to apply**:
- E2E spec 가 동일 seed user / shared DB row / shared external resource 사용 시 명시적으로 serial:
  ```ts
  test.describe.configure({ mode: "serial" });
  ```
- CI 의 `workers` config 와 *별개로* spec 파일 내부 명시
- 또는 spec 별 unique fixture (e2e1@test.com, e2e2@test.com) 도입
- single-session enforcement / unique constraint / row-level lock 등 *동시성에 민감한 server-side 동작* 이 검증 대상이라면 *반드시* serial

## Anti-pattern

- ❌ "unit test 다 통과했으니 acceptance 도 통과겠지" — Axis 3 위반
- ❌ "spec comment 는 doc 일 뿐 구현이 ground truth" — Axis 2 역방향. spec 이 ground truth, 구현이 honour
- ❌ "기존 패턴 (reading_handler) 만 보고 카논 추정" — Axis 1 위반. 신규 wire 는 catalog 도 봐야
- ❌ "E2E 한 번 PASS 했으니 안전" — workers config 안 보고 false positive 가능. Axis 4 우선 확인

## 함께 쓸 카논

- `feedback_task_completion_report.md` — 코딩 작업 완료 6 섹션 보고 형식 (PR review 단계와 별개 — task 단위)
- `feedback_4agent_review_before_admin_merge.md` — 4-agent 리뷰 정책 (본 체크리스트 *후* 진입)
- `refs/post-task-pipeline-bridge.md` — review-mmp skill bridge

## PR-9 회고 매핑

본 체크리스트의 4 axis 가 PR-9 의 사전 catch 가능했던 결함:
- Axis 1 → retro fix `f58eb46` (dot-form 정렬)
- Axis 2 → BLOCKER C-1 (mass user lockout)
- Axis 3 → SocialHub fix `204e413`
- Axis 4 → spec serial mode 추가 (`af52735` → `204e413` 의 spec 변경)

4 가지 모두 *사전 self-check* 로 catch 가능했음. 본 카논 도입 후 첫 적용 PR 부터 metric (review 통과 횟수 vs 회귀 fix 횟수) 측정 권장.

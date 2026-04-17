# Severity Rubric — Phase 19 감사

> design.md §Severity Rubric 초안을 실제 판단에 쓸 수 있도록 구체화.
> **관점이 primary, 파일은 hint** — 타 영역이 동일 파일을 보더라도 severity는 관점 기준으로 매긴다.

## 결정 순서 (모든 Finding 공통)

1. **영향 범위**: 프로덕션·공개 API·사용자 데이터에 닿으면 P0 후보.
2. **재현 가능성**: 현재 main 기준 재현 가능 → 우선. 가설·이론적 → 한 단계 하향.
3. **완화책 유무**: Feature flag off·미출시 경로 → 한 단계 하향. 단, 보안·PII는 하향 금지.
4. **증거**: `file:line` + 실행 시나리오 최소 1건 필수. 없으면 Finding 제외.

## P0 — 프로덕션 차단 (이번 릴리스 전 필수)

**정의**: 프로덕션 보안 사고·데이터 유실·즉시 장애. 완화책 없음 또는 이미 실사용자 노출.

**MMP v3 문맥 예시 3**:

- **PII/권한 스냅샷 누설**: `Session.SendSnapshot`이 역할 민감 모듈(hidden_mission, whisper 등)의 전체 상태를 모든 플레이어에게 push한다면 P0. (참조: Phase 18.1 B-2 `PlayerAwareModule.BuildStateFor` 부재 시 재발 가능.)
- **RFC 9457 우회 `http.Error`**: public HTTP 핸들러가 `http.Error`로 내부 에러 메시지를 노출하면 P0 — error code registry·Sentry trace·auditlog 파이프라인 전체 우회. (참조: Phase 18.4 M-2 `TemplateHandler` 사건.)
- **Migration drift**: goose 최신 버전과 `goose_db_version` 최댓값 불일치 상태로 릴리스하면 SQLSTATE 42P01로 전체 기능 fail. (참조: Phase 18.7 hotfix #53 촉발 사건.)

## P1 — 이번 분기 (UX 중대 저해·확장 병목·팀 생산성)

**정의**: 사용자가 즉시 체감하는 UX 퇴보, 스케일 시 장애 예고, 팀 병목. 워크어라운드는 존재.

**MMP v3 문맥 예시 3**:

- **낙관적 업데이트 rollback 누락**: editor에서 optimistic setQueryData만 있고 server 실패 시 invalidate 없으면 "저장 성공 착시" → P1. (참조: Phase 18.4 W2 `CharacterAssignPanel.pendingRef` stale basis.)
- **파일 크기 티어 초과 누적**: Go 500/TS·TSX 400 상한 넘는 파일이 한 Phase에 **10개 이상** 존재하면 P1. 단일 파일 초과는 P2. (baseline 기준: Go 수동 10개 초과 → 즉시 P1.)
- **WS envelope 3자 drift**: 백엔드 envelope_catalog에 새 타입을 추가했지만 MSW handler·reducer 미반영 → 프론트 빌드는 통과하나 런타임에 `unknown message type` warning → UX 조용히 실패. P1.

## P2 — 백로그 (품질·기술 부채)

**정의**: 관측 가능하지만 기능 영향 미미. 커버리지 부족, 중복 코드, 스타일 위반.

**MMP v3 문맥 예시 3**:

- **단위 테스트 커버리지 0%인 패키지 방치**: Phase 18.7에서 `coin/creator/sound/voice/infra` 5개 패키지가 0% — 회귀 리스크는 있으나 현재 영향 없음. P2.
- **Zustand slice 경계 흐트러짐**: Connection layer(WS 세션)와 Domain layer(게임 상태)가 같은 store에서 섞이면 refactor 부채. 런타임 영향 없으면 P2.
- **스타일 토큰 하드코딩**: Tailwind class 대신 `#ffffff` 리터럴 1~3곳은 P2. 디자인 시스템 이탈이 광범위(10+곳)하면 P1로 승격.

## 경계 케이스 — 판단 가이드

| 케이스 | 결정 기준 |
|--------|---------|
| "flag off라 사용자 미노출" 보안 이슈 | **flag가 prod default 여부**가 결정. default off + release gate 명확 → P1. flag가 config 기반이라 staging에서 ON 가능 → P0 유지. (PII·인증·SQL injection은 예외 없이 P0.) |
| 테스트만 실패하고 프로덕션 영향 없음 | CI 차단 → P1 (배포 파이프라인 정지). CI skip/warn-only → P2. |
| 단일 파일 한도 초과(Go 520줄 등) | 기능 영향 없음 → P2. 같은 Phase에 3개 이상 동시 초과 → P1 (리팩터 부채 누적). |
| 관찰성/로그 개선 제안 | 현재 incident 조사가 실제 막힌 기록 있음 → P1. 예방적 개선 → P2. |

## scope-matrix 9 영역별 P0 시드 샘플

> "이런 패턴이면 무조건 P0"를 영역별로 1줄. executor가 draft 쓸 때 트리거 샘플로 사용.

- **01 go-backend**: Handler가 Service/Repo 없이 DB·WS·Redis를 직접 호출하는 public 엔드포인트.
- **02 react-frontend**: Zustand Connection layer가 sensitive token(JWT, session key)을 localStorage에 평문 저장.
- **03 module-architect**: `BaseModule` 미상속 또는 Factory를 우회해 싱글턴으로 등록된 모듈(세션 간 상태 누설).
- **04 test-engineer**: Critical path(auth, start game, snapshot redaction) 테스트 `t.Skip`·`test.skip`으로 비활성.
- **05 security**: 공개 핸들러에 권한 검사 누락 + DB write 경로(IDOR), 또는 WS 토큰이 로그·에러 응답에 평문 출력.
- **06 perf-observability**: 세션당 goroutine leak 패턴(ticker·chan select 누수) 재현 가능, pprof heap에서 증가 확인.
- **07 design-a11y**: 주요 플로우에서 focus trap 미구현 모달·키보드 접근 불가 버튼으로 WCAG 2.1 A 미달(법적 리스크).
- **08 docs-navigator**: 프로덕션 문서(README·CLAUDE.md·설계 index)와 실제 구현이 drift해서 **신규 팀원 온보딩이 잘못된 경로로 유도됨**(검증 가능 사례 제시).
- **09 ws-contract**: 백엔드가 sensitive payload(타 플레이어 역할·미션 정답)를 broadcast하면서 프론트 reducer가 redaction 없이 전체 반영(Phase 18.1 B-2 재발 패턴).

## 태깅 규칙

- 모든 Finding 헤더에 `Severity: P0|P1|P2` 명시.
- 경계 케이스는 `Severity: P1 (경계: P0 후보)` 형태로 근거 1줄 추가.
- cross-area로 포워딩되는 경우 원 영역의 severity를 유지하고, 수신 영역은 `[cross:source]` 태그 + 독립 판단.

## W3 Advisor 롤업 기대치

- P0 ≤ 10 (design.md §검증 조건). 초과 시 Advisor가 재분류 또는 cross-cutting으로 묶음.
- P0 + P1 ≥ 50% (각 draft 내부). P2만 나열된 draft는 스코프 부족 신호.
- executive-summary에서 P0 각각 "해당 릴리스 전 필수" 근거 1줄 필수.

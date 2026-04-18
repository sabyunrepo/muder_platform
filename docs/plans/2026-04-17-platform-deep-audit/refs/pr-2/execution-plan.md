# PR-2 Split — 실행 계획 + Wave 배치

> PR-2a · PR-2b · PR-2c 머지 순서, 병렬성, feature flag, 리스크 완화 전략.

## Wave 배치

Phase 19 backlog (`phase19-backlog.md`) 의 wave 구조를 기준으로 다음 배치 권장:

```
W2 잔여
  └─ PR-2a (S, Low) ─── engine gate + stub + 33 모듈 marker  [단독, 의존 없음]

W3 전반
  └─ PR-2b (L, Med) ─── 12 모듈 real 구현 (combination 제외)  [PR-2a 의존]

W3 후반
  └─ PR-2c (S-M, Low) ─ combination crafted redaction        [PR-2a 의존, PR-2b 선 머지 권장]
```

**합산**: 원 PR-2 XL 분량은 유지하되 wave 2개에 분할. W3 부담이 크므로 다른 W3 PR 과 밸런싱 필요 — phase19-backlog.md 업데이트 시 W3 총량 재확인.

## 병렬 / 순차 판정

| 쌍 | 판정 | 근거 |
|----|-----|------|
| PR-2a ↔ PR-2b | **순차 필수** | PR-2a 의 gate 가 PR-2b stub 교체의 안전판. PR-2a 없이 PR-2b 만 머지하면 PR-2b 브랜치에 33 모듈 marker 까지 포함 → PR 거대화. |
| PR-2a ↔ PR-2c | **순차 필수** | 동일 근거. |
| PR-2b ↔ PR-2c | **순차 권장** (병렬 가능) | 다른 파일 touch (PR-2c 는 combination.go 만, PR-2b 는 combination 제외). 이론상 병렬 가능하나 리뷰 부하와 merge conflict (combination.go 가 PR-2b 카테고리 커밋에서 실수로 포함될 위험) 완화 위해 순차. |

## Feature Flag 전략

| PR | Flag | 기본값 | 목적 |
|----|------|-------|------|
| PR-2a | 없음 | - | compile-time gate 이므로 flag 불요 |
| PR-2b | `MMP_PLAYERAWARE_STRICT` | true | 프로덕션 이슈 시 false → 각 BuildStateFor 가 `m.BuildState()` fallback. 30일 후 제거. |
| PR-2c | (PR-2b flag 재사용) | true | 동일 flag 로 combination 도 제어 |

**구현**: `engine/factory.go` 또는 `engine/build_state_for.go` 에 전역 config 읽어 `BuildModuleStateFor` 내부에서 flag false 시 `m.BuildState()` 강제 호출. 모듈 내부 `BuildStateFor` 는 무조건 real 구현이되, 호출 경로에서 단일 스위치로 우회.

```go
// engine/types.go 개정 (PR-2b 시점)
var strictRedaction = os.Getenv("MMP_PLAYERAWARE_STRICT") != "false"

func BuildModuleStateFor(m Module, playerID uuid.UUID) (json.RawMessage, error) {
    if !strictRedaction {
        return m.BuildState()
    }
    if pam, ok := m.(PlayerAwareModule); ok {
        return pam.BuildStateFor(playerID)
    }
    return m.BuildState() // PublicStateModule path
}
```

## 리스크 + 완화

### R1. 25개 모듈 동시 구현 시 git conflict
- **영향**: 다른 진행 중 PR (에디터·CI·phase 20 후속) 과 충돌 확률 높음. 특히 crime_scene/evidence/location, communication/group_chat 은 Phase 20 개방 이후 에디터 연동 작업이 잦음.
- **완화**:
  - PR-2a 는 marker 추가만이라 conflict 표면적 작음. 우선 머지.
  - PR-2b 커밋을 카테고리별로 분리(crime_scene · decision · communication · exploration · progression). 각 카테고리 커밋을 PR 내부에서 독립 commit 유지 → rebase 시 cherry-pick 가능.
  - PR-2b 브랜치를 open 단계에서 최대 3일 내 머지 목표. 그 이상 시 cherry-pick 재베이스 부담.

### R2. 모듈 author 다양성 (PR-2b 25 모듈을 누가 리뷰하나)
- **영향**: 각 모듈 도메인 지식이 분산 (crime_scene 저자 ≠ decision 저자). 단일 리뷰어가 13 모듈 변경을 전부 검토하기 어렵다.
- **완화**:
  - `requesting-code-review` skill 로 카테고리별 review 분할 요청.
  - 리뷰 체크리스트 표준화: "민감 필드 리스트 명시 / helper 사용 / 단위 테스트 3케이스". `refs/pr-2/current-state.md` 의 민감 필드 섹션을 리뷰어 체크리스트 소스로 사용.

### R3. Redaction coverage 측정 방법
- **영향**: PR-2b 머지 후 "정말로 25 → 0 fallback" 이 된 것을 측정하지 않으면 재발 가능.
- **완화**:
  - PR-2a 가 제공하는 registry gate 가 영구 불변식 (신규 모듈도 자동 검증).
  - CI lint: `scripts/check-playeraware-coverage.sh` — engine 패키지 interface assertion 블록 수 + module 패키지 BuildStateFor 구현 수 cross-check.
  - 정기 감사: Phase 20 이후 half-yearly 감사에 PlayerAware coverage 메트릭 포함.

### R4. 게임 디자인 의도 충돌 (F-03 특유)
- **영향**: evidence/location 이 "전원 공유" 인지 "개인 수첩" 인지 제품 결정 필요. 구현을 완료했는데 디자인이 "전원 공유" 로 확정되면 rollback.
- **완화**:
  - PR-2a 착수 전 W3 advisor 승인 필수 (03-module-architect Advisor-Ask §1).
  - Feature flag 로 staging 에서 A/B 실험 가능.
  - PublicStateMarker 로 재분류하는 것만으로 rollback 가능 (BuildStateFor 메서드는 남아도 호출 안됨).

## 측정 지표 (Before → After 목표)

| Metric | Baseline (main) | PR-2a 직후 | PR-2b 직후 | PR-2c 직후 |
|--------|----------------:|----------:|----------:|----------:|
| PlayerAware real impl | 8/33 | 8/33 (+ 13 stub) | 20/33 | 21/33 |
| PublicState marker | 0/33 | 12/33 | 12/33 | 12/33 |
| Registry gate coverage | 0% | 100% | 100% | 100% |
| snapshot_redaction_test 케이스 | 3 | 3 | 3+3 = 6 | 6+1 = 7 |
| F-sec-2 잔여 P0 | Open | Open | Resolved | - |
| F-03 잔여 P0 | Open | Open | Resolved | - |
| D-MO-1 잔여 P0 | Open | Open | Open | Resolved |

## 외부 의존성

- **advisor-consultations.md**: PR-2a 착수 전 결정 항목 — "PlayerAware 의무화 boot-fail 방식 승인", "evidence/location 게임 디자인 정책", "gm_control PublicState 재분류 여부".
- **module-inventory.md**: W1 drift 수치 (PlayerAware 0/33 → 8/33, ConfigSchema 22/33 → 21/33) 를 **PR-2a 머지 전** 교정. Reviewer 가 참조하는 ground truth.
- **project_module_system.md** (memory): PR-2a 머지 후 "PlayerAwareModule 은 **선택** 이 아니라 **의무** (PublicStateMarker 로 opt-out 가능)" 로 규약 기술 업데이트.

## 완료 정의 (Definition of Done)

- [ ] PR-2a · 2b · 2c 전부 main 머지
- [ ] Phase 19 backlog 에서 PR-2 엔트리 resolved 표시
- [ ] memory/MEMORY.md 에 Phase 19 PR-2 entry 업데이트
- [ ] `CLAUDE.md` 의 "모듈 시스템" 섹션에 PlayerAware mandatory 룰 반영 (mmp-module-factory 스킬도 업데이트)
- [ ] `scripts/check-playeraware-coverage.sh` 가 CI required check 로 승격
- [ ] staging 에서 `MMP_PLAYERAWARE_STRICT=true` 로 1주간 운영 후 flag 제거 티켓 생성

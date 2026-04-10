# Phase F: Crime Scene Plugin + Architecture Validation

> 부모: [../design.md](../design.md)
> 선행: Phase B (Murder Mystery) + Phase E (Editor L3) 완료

---

## PR 구성 (4 PRs, F1-F2 병렬 후 F3-F4 순차)

### PR-F1: CrimeScenePlugin Core

**패키지**: `genre/crime_scene/` (plugin, phases, handler, win_checker, phase_hook, types, config)

**기본 페이즈**: `[Intro] → [Evidence Review] → [Exploration] ↔ [Additional Rounds] → [Discussion] → [Accusation] → [Resolution]`

**Validate**: `explore_location`(접근 권한), `search_evidence`(탐색 횟수), `combine_evidence`(조합 단서 소유), `trade_evidence`(교환 가능), `make_accusation`(핵심 증거 3종 보유)

**Apply**: 장소 이동, 장소별 증거 랜덤 배치 + `ClueValidator.CanDiscover`, `ClueGraph.FindCombination` 조합 결과, 소유권 이전, 단서 파괴

**CheckWin**: 핵심 증거 3종(동기/기회/무기) 조합 완료 시 `WinResult{Winner: "investigators"}`

**OnPhaseEnter**: Exploration 진입 시 새 단서 해금 + `EventClueDistributed` 발행

---

### PR-F2: LocationRestriction + VisibilitySpec (F1과 병렬)

**LocationValidator 확장** (`clue/validator.go`)
- `RequiredRole`: 특정 역할만 탐색 가능 (예: 경찰만 지문 채취)
- `RequiredItem`: 특정 아이템 소유 시 접근 (예: 열쇠로 방 열기)
- `MaxSearches`: 장소별 탐색 횟수 제한, 초과 시 `apperror.Forbidden`

**VisibilitySpec 적용** (`clue/visibility.go`)
```go
// 탐색 페이즈 + 특정 장소에 있는 플레이어만
explorationSpec := NewPhaseSpec("exploration").And(NewLocationSpec("room_1"))

// 경찰 역할 + 토론/지목 페이즈
analysisSpec := NewRoleSpec("detective").And(
    NewPhaseSpec("discussion").Or(NewPhaseSpec("accusation")))
```

---

### PR-F3: CrimeSceneView (프론트엔드)

**CrimeSceneView.tsx** -- 보드게임 스타일 맵 뷰
- `LocationBoard`: 장소 그리드 (탐색 가능/잠김/완료, 남은 횟수)
- `EvidencePanel`: 보유 증거 + 조합 인터페이스
- `CombinationDialog`: 재료 선택 → 결과 미리보기
- `AccusationForm`: 핵심 증거 3종 제출 + 범인 지목
- `useGameEvents` 훅으로 Crime Scene 이벤트 구독 → Zustand 갱신

---

### PR-F4: Architecture Validation + Editor Preset

**공통 코드 비율 측정** (CI 자동화)
```bash
shared=$(find genre/shared -name '*.go' | xargs wc -l | tail -1)
total=$(find genre -name '*.go' | xargs wc -l | tail -1)
# 목표: shared/total >= 60%
```

**격리 테스트**: CrimeScene 변경 → MurderMystery 컴파일/테스트 통과 (역방향도)

**에디터 프리셋**: "보드 탐정 4인"(floor, 2라운드, 역할 접근 없음) + "증거 조합 6인"(room, 3라운드, 역할 접근 있음)

---

## 테스트 전략

| 항목 | 방법 |
|------|------|
| E2E | "6인, 3라운드 탐색, 증거 조합으로 범인 지목" 시나리오 |
| LocationRestriction | 역할/아이템/횟수 제한 각각 단위 테스트 |
| VisibilitySpec | AND/OR/NOT 복합 조건 평가 정확성 |
| 공통 코드 | CI 자동 측정 + 60% 임계값 |
| 격리 | 크로스 컴파일 + 크로스 테스트 CI job |

---

## 수용 기준

- [ ] CrimeScenePlugin이 Core + Optional 6개 모두 구현
- [ ] LocationRestriction 3가지 제한(역할/아이템/횟수) 정상 동작
- [ ] VisibilitySpec 복합 조건이 JSON Logic 평가와 일치
- [ ] CrimeSceneView에서 장소 탐색/증거 조합/지목 가능
- [ ] 공통 코드 비율 60%+ + 장르 간 격리 테스트 통과
- [ ] 에디터 프리셋 2종이 ConfigSchema 폼에 올바르게 로드

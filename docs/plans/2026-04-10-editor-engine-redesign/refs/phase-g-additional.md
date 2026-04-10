# Phase G: ScriptKill + Jubensha (Additional Genres)

> 부모: [../design.md](../design.md)
> 선행: Phase F (Crime Scene + Architecture Validation) 완료

---

## PR 구성 (5 PRs, G1+G2 병렬 → G3+G4 병렬 → G5)

### PR-G1: ScriptKillPlugin Core (G2와 병렬)

**패키지**: `genre/script_kill/` (plugin, phases, handler, win_checker, phase_hook, script_manager, config)

**기본 페이즈**: `[Intro] → [Round N: Read] → [Round N: Discuss] → [Vote] → ... → [Final Vote] → [Reveal]`

**ScriptManager** (장르별 상태)
```go
type ScriptState struct {
    CurrentRound   int                      `json:"currentRound"`
    TotalRounds    int                      `json:"totalRounds"`
    PlayerProgress map[string]RoundProgress `json:"playerProgress"`
    RevealOrder    string                   `json:"revealOrder"` // sequential|simultaneous|custom
}
```

**Validate**: 읽기 완료 후 토론 진행, 토론 시간 경과 후 투표, 공개 순서 준수

**Apply**: 스크립트 페이지 넘기기(시간 제한), 캐릭터 정보 공개, 라운드별 투표+집계

**OnPhaseEnter**: Read→해당 라운드 스크립트 배부(revealOrder 기준), Discuss→읽기 미완료 강제 종료

---

### PR-G2: JubenshaPlugin Core (G1과 병렬)

**패키지**: `genre/jubensha/` (plugin, phases, handler, phase_hook, voice_manager, group_manager, config)

**기본 페이즈**: `[Intro] → [Role Reveal] → [Read Script] → [Investigation] → [Rest] → [Group Discussion] → [Rest] → [Debate] → [Final Vote] → [Reveal]`

**고유 기능 -- PhaseHookPlugin**
- Rest 페이즈 진입: LiveKit subroom 자동 생성 (groupSize 기준 분할)
- BGM 전환 (휴식용 음악) + 타이머 만료 시 메인 룸 병합

**VoiceManager** (LiveKit 통합)
```go
func (vm *VoiceManager) CreateSubGroups(ctx context.Context, state GameState, groupSize int) ([]SubGroup, error)
func (vm *VoiceManager) MergeAll(ctx context.Context) error  // 모든 subroom → 메인 병합
```

**GroupManager**: 플레이어를 groupSize 기준 분할, 같은 팀/역할 분산 전략

---

### PR-G3: ScriptKillView + Editor Preset (G4와 병렬)

**ScriptKillView.tsx**
- `ScriptViewer`: 스크립트 표시 (페이지 단위, 자동 넘김)
- `ReadingProgress`: 전체 읽기 진행률 (예: "읽기 완료: 4/6명")
- `ScriptRevealIndicator`: sequential 모드 시 현재 공개 플레이어 표시
- `RoundInfoBar`: 현재/전체 라운드 상태

**에디터 프리셋**: "3라운드 스크립트"(simultaneous, 5분 읽기/10분 토론) + "5라운드 미스터리"(sequential, 10분 읽기/15분 토론)

---

### PR-G4: JubenshaView + Editor Preset (G3과 병렬)

**JubenshaView.tsx**
- `FirstPersonScriptView`: 1인칭 몰입형 UI (폰트/배경 테마)
- `BGMController`: 페이즈별 BGM 재생/전환
- `VoiceChannelPanel`: LiveKit 상태 + 참가자 목록
- `GroupPanel`: 그룹 정보 + 멤버 + 1:1 밀담 접속
- `RestPhaseOverlay`: 휴식 전용 UI (타이머 + 밀담방)
- `MediaViewer`: 스크립트 내 이미지/오디오/비디오

**에디터 프리셋**: "감성 추리 6인"(first_person, 3분 휴식, 3인 그룹) + "하드코어 추리 8인"(mixed, 2분 휴식, 4인 그룹)

---

### PR-G5: Cross-Genre Integration Test

**4장르 E2E 시나리오**

| 장르 | 시나리오 | 검증 |
|------|----------|------|
| Murder Mystery | 6인 3라운드 범인 지목 | 기본 플로우 |
| Crime Scene | 6인 3라운드 증거 조합 | LocationRestriction + VisibilitySpec |
| Script Kill | 8인 5라운드 순차 공개 | 읽기 시간 + 공개 순서 |
| Jubensha | 8인 4라운드 음성 추리 | LiveKit subroom + BGM (mock) |

**CI 추가**: 장르별 독립 job, 크로스 격리 테스트, 공통 코드 비율 자동 측정 (목표 55%+)

---

## 수용 기준

- [ ] ScriptKillPlugin: Core + GameEventHandler + WinChecker + PhaseHook 구현
- [ ] JubenshaPlugin: Core + PhaseHook (음성/그룹) 구현
- [ ] 읽기 시간 제한 + 자동 진행 정상 동작
- [ ] LiveKit subroom 생성/해제/병합 정상 동작 (mock)
- [ ] ScriptKillView: 스크립트 뷰어 + 진행률 표시
- [ ] JubenshaView: 1인칭 뷰 + 음성 패널 + BGM 제어
- [ ] 각 장르 프리셋 2종이 ConfigSchema 폼에 올바르게 로드
- [ ] 4장르 크로스 통합 테스트 통과 + 공통 코드 55%+

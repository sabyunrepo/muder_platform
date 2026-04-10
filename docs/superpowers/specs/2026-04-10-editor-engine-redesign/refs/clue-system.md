# 단서 시스템 상세

> 부모: [../design.md](../design.md)

---

## 데이터 모델

```go
type ClueType string
const (
    ClueTypeEvidence   ClueType = "evidence"    // 물리적 증거
    ClueTypeTestimony  ClueType = "testimony"   // 증언
    ClueTypeWeapon     ClueType = "weapon"      // 무기
    ClueTypeAlibi      ClueType = "alibi"       // 알리바이
    ClueTypeDeduction  ClueType = "deduction"   // 추론 결과
    ClueTypeKeyItem    ClueType = "key_item"    // 핵심 아이템
    ClueTypeRedHerring ClueType = "red_herring" // 오도성 단서
)

type Clue struct {
    ID          string     `json:"id"`
    Name        string     `json:"name"`
    Type        ClueType   `json:"type"`
    Category    string     `json:"category"`     // 자유 분류
    Description string     `json:"description"`
    Content     JSON       `json:"content"`      // 이미지/텍스트/오디오

    Distribution ClueDistribution `json:"distribution"`
    Visibility   ClueVisibility   `json:"visibility"`
    Interactions ClueInteraction  `json:"interactions"`
    Effects      ClueEffect       `json:"effects"`
    Location     *LocationRestriction `json:"locationRestriction,omitempty"`
}

type ClueDistribution struct {
    Method             string   `json:"method"`               // starting|round|timed|conditional|location|trade|manual
    Round              *int     `json:"round,omitempty"`
    TimeAfterPhaseStart *int    `json:"timeAfterPhaseStart,omitempty"`
    LocationID         *string  `json:"locationId,omitempty"`
    RequiredClueIDs    []string `json:"requiredClueIds,omitempty"`
    RequiredClueCombo  []string `json:"requiredClueCombo,omitempty"`
    Condition          *Rule    `json:"condition,omitempty"`   // JSON Logic
}

type ClueVisibility struct {
    Default          string             `json:"default"`           // private|team|public
    RevealOnPhase    *string            `json:"revealOnPhase,omitempty"`
    RevealOnCondition *Rule             `json:"revealOnCondition,omitempty"`
    PlayerOverrides  []PlayerVisibility `json:"playerOverrides,omitempty"`
}

type ClueInteraction struct {
    Tradeable   bool     `json:"tradeable"`
    Showable    bool     `json:"showable"`
    Combinable  bool     `json:"combinable"`
    CombineWith []string `json:"combinableWith,omitempty"`
    CombinationResult *string `json:"combinationResult,omitempty"`
    Destroyable bool     `json:"destroyable"`
    Countable   bool     `json:"countable"`
    MaxUses     *int     `json:"maxUses,omitempty"`
}

type ClueEffect struct {
    IsWeapon        bool    `json:"isWeapon"`
    WeaponDamage    *int    `json:"weaponDamage,omitempty"`
    UnlocksLocation *string `json:"unlocksLocation,omitempty"`
    UnlocksPhase    *string `json:"unlocksPhase,omitempty"`
    TriggersEvent   *string `json:"triggersEvent,omitempty"`
    GrantAbility    *string `json:"grantAbility,omitempty"`
}

type LocationRestriction struct {
    LocationID    string  `json:"locationId"`
    RequiredRole  *string `json:"requiredRole,omitempty"`
    RequiredItem  *string `json:"requiredItem,omitempty"`
    MaxSearches   *int    `json:"maxSearches,omitempty"`
}
```

---

## 의존성 그래프 (Composite 패턴)

```go
// ClueGraph — 단서 의존성/조합 그래프
type ClueGraph struct {
    nodes map[string]*ClueGraphNode
    edges map[string][]ClueEdge
}

type ClueGraphNode struct {
    Clue     Clue
    Deps     []string  // 선행 단서 ID
    Combos   []string  // 조합 필요 단서 ID
    Results  []string  // 이 단서가 조합 재료인 결과 단서 ID
}

type ClueEdge struct {
    From    string
    To      string
    Type    EdgeType  // "requires" | "combines_with" | "unlocks"
}

// 위상 정렬로 발견 가능 순서 계산
func (g *ClueGraph) TopologicalSort() ([]string, error)

// 순환 참조 검출
func (g *ClueGraph) DetectCycles() [][]string

// 조합 규칙 조회
func (g *ClueGraph) FindCombination(inputClueIDs []string) *Clue
```

---

## ClueValidator (Chain of Responsibility)

```go
// ClueValidator — 단서 발견 검증 체인
type ClueValidator struct {
    graph *ClueGraph
    chain Validator
}

func NewClueValidator(graph *ClueGraph) *ClueValidator {
    v := &ClueValidator{graph: graph}
    v.chain = NewPrerequisiteValidator(graph).
        SetNext(NewCombinationValidator(graph)).
        SetNext(NewLocationValidator()).
        SetNext(NewRoleValidator()).
        SetNext(NewConditionValidator())
    return v
}

func (v *ClueValidator) CanDiscover(ctx context.Context, playerID, clueID string, state GameState) error {
    return v.chain.Validate(ctx, playerID, clueID, state)
}

// 개별 Validator
type PrerequisiteValidator struct { graph *ClueGraph; next Validator }
type CombinationValidator struct { graph *ClueGraph; next Validator }
type LocationValidator struct { next Validator }
type RoleValidator struct { next Validator }
type ConditionValidator struct { next Validator }  // JSON Logic 평가
```

---

## VisibilitySpec (Specification 패턴)

```go
type VisibilitySpec interface {
    IsSatisfiedBy(playerID string, state GameState) bool
    And(other VisibilitySpec) VisibilitySpec
    Or(other VisibilitySpec) VisibilitySpec
    Not() VisibilitySpec
}

// 구현체
type RoleSpec struct{ role string }
type PhaseSpec struct{ phase string }
type ClueOwnedSpec struct{ clueID string }
type TeamSpec struct{ team string }
type PlayerSpec struct{ playerID string }
type LogicSpec struct{ rule json.RawMessage }

// 조합
spec := NewRoleSpec("detective").And(
    NewPhaseSpec("investigation").Or(
        NewClueOwnedSpec("clue_001"),
    ),
)
```

---

## 에디터 단서 뷰 3가지

### 리스트 뷰 (기본)
- 테이블 형태: ID, 이름, 타입, 배포방식, 선행단서, 유효성 상태
- CRUD: 추가, 수정, 삭제, 복제
- 검색/필터: 타입별, 배포방식별

### 그래프 뷰 (React Flow)
- 노드: 각 단서 (타입별 색상/아이콘)
- 엣지: 의존성 (실선), 조합 (점선), 해금 (파선)
- 드래그앤드롭: 새 단서 추가, 연결 변경
- 자동 배치: dagre 기반 위상 정렬 레이아웃

### 상세 편집 (우측 패널)
- ConfigSchema 기반 자동 폼
- 선행 단서 선택기 (그래프에서 연결)
- 조합 규칙 편집 (다중 선택)
- 가시성 규칙 편집 (Specification Builder)
- 게임 효과 설정 (장소 해금, 능력 부여 등)
- 위치 제한 설정 (장소, 역할, 탐색 횟수)

---

## 단서 관련 이벤트

```go
const (
    EventClueDistributed   = "clue.distributed"    // 단서 배포됨
    EventClueDiscovered    = "clue.discovered"     // 단서 발견됨
    EventClueCombined      = "clue.combined"       // 단서 조합 성공
    EventClueRevealed      = "clue.revealed"       // 단서 공개됨
    EventClueTraded        = "clue.traded"         // 단서 교환됨
    EventClueShown         = "clue.shown"          // 단서 보여주기
    EventClueDestroyed     = "clue.destroyed"      // 단서 소모/파괴됨
    EventClueLocationLocked = "clue.location_locked" // 장소 탐색 불가
)
```

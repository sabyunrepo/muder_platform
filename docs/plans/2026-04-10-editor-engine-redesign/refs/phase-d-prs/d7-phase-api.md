# PR D-7: Phase Template API (백엔드)

> Phase D | 의존: 없음 | Wave: W1 (D-1~D-6과 병렬)

---

## 목표
페이즈 템플릿 CRUD + 장르별 기본 템플릿 제공.
config_json.phase_template에 저장 (별도 테이블 불필요).

## 변경 파일

**신규 (Backend)**
```
apps/server/internal/domain/editor/
  phase_handler.go               # GET/PUT phase_template
  phase_types.go                 # PhaseTemplate, ClueDistribution types
  phase_service.go               # 템플릿 CRUD + 검증
```

**수정 (Backend)**
```
apps/server/internal/domain/editor/
  handler.go                     # Router에 phase routes
  service.go                     # Service interface 확장
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/v1/editor/themes/{id}/phase-template` | 페이즈 템플릿 조회 |
| PUT | `/v1/editor/themes/{id}/phase-template` | 템플릿 저장 (전체 교체) |
| GET | `/v1/editor/genres/{id}/phase-template` | 장르별 기본 템플릿 |

## PhaseTemplate 데이터 모델

```go
type PhaseTemplate struct {
    ID                  string                 `json:"id"`
    PhaseType           string                 `json:"phaseType"`
    Label               string                 `json:"label"`
    Duration            int                    `json:"duration"`
    SortOrder           int                    `json:"sortOrder"`
    Config              map[string]interface{} `json:"config,omitempty"`
    TimerEnabled        bool                   `json:"timerEnabled"`
    ClueDistribution    *ClueDistribution      `json:"clueDistribution,omitempty"`
    TransitionCondition json.RawMessage        `json:"transitionCondition,omitempty"`
}

type ClueDistribution struct {
    Method              string          `json:"method"`
    Round               *int            `json:"round,omitempty"`
    TimeAfterPhaseStart *int            `json:"timeAfterPhaseStart,omitempty"`
    ClueIDs             []string        `json:"clueIds,omitempty"`
    Condition           json.RawMessage `json:"condition,omitempty"`
}
```

## 검증 규칙

```go
func (s *service) ValidatePhaseTemplate(tmpl []PhaseTemplate) error {
    if len(tmpl) == 0 { return err("at least one phase required") }
    if len(tmpl) > 50 { return err("max 50 phases") }
    if tmpl[0].PhaseType != "intro" { return err("first must be intro") }
    if tmpl[len(tmpl)-1].PhaseType != "reveal" { return err("last must be reveal") }
    // 중복 ID 검사
    // JSON Logic 조건 검증 (diegoholiveira/jsonlogic)
}
```

## 저장 방식

- `phase_template`를 `themes.config_json.phase_template` JSONB에 저장
- 별도 테이블 불필요
- flow_layout도 동일하게 config_json에 저장

## 테스트

- `phase_handler_test.go`: GET/PUT 200/400/404
- `phase_service_test.go`: 검증 (50제한, start/end, 중복ID)
- JSON Logic: diegoholiveira/jsonlogic로 100개 식 평가

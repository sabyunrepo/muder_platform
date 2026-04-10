# Phase C: Editor Layer 1 — Template Studio (MVP)

> 부모: [../design.md](../design.md) | 선행: Phase B (MM 장르)
> **목표**: 비개발자가 장르 프리셋으로 테마를 제작하는 폼 기반 에디터

---

## PR Overview

| PR | 제목 | 단계 | 의존 | 병렬 |
|----|------|------|------|------|
| C-1 | Editor 3-column layout + EditorUIStore 확장 | C1 | 없음 | -- |
| C-2 | GenreSelector + 프리셋 로딩 API | C2 | C-1 | C-3과 병렬 |
| C-3 | SchemaDrivenForm (react-hook-form + zod) | C3 | C-1 | C-2와 병렬 |
| C-4 | Character CRUD (리팩토링) | C4 | C-1 | C-2~C-3과 병렬 |
| C-5 | Clue list view + Clue API 확장 | C5 | C-1 | C-2~C-4와 병렬 |
| C-6 | Auto-save + validation 통합 | C6 | C-1~C-5 | -- |
| C-7 | Theme API genre/preset 확장 (백엔드) | C7 | 없음 | C-1~C-6과 병렬 |

### Wave 구조

```
W1: C-7 (백엔드) ───────────────────────┐
W1: C-1 (레이아웃)                        │
W2: C-2 ─ C-3 ─ C-4 ─ C-5 (병렬) ──────┤
W3: C-6 (통합) ◄─────────────────────────┘
```

### PR 상세 문서

| 파일 | 내용 |
|------|------|
| [phase-c-prs/c1-layout.md](phase-c-prs/c1-layout.md) | C-1: 3-column 레이아웃 + EditorUIStore |
| [phase-c-prs/c2-genre-selector.md](phase-c-prs/c2-genre-selector.md) | C-2: 장르 선택 + 프리셋 로드 |
| [phase-c-prs/c3-schema-form.md](phase-c-prs/c3-schema-form.md) | C-3: ConfigSchema 자동 폼 |
| [phase-c-prs/c4-character-crud.md](phase-c-prs/c4-character-crud.md) | C-4: 캐릭터 CRUD 리팩토링 |
| [phase-c-prs/c5-clue-list.md](phase-c-prs/c5-clue-list.md) | C-5: 단서 리스트 + API 확장 |
| [phase-c-prs/c6-autosave-validation.md](phase-c-prs/c6-autosave-validation.md) | C-6: 자동저장 + 검증 |
| [phase-c-prs/c7-genre-api.md](phase-c-prs/c7-genre-api.md) | C-7: 장르/프리셋 백엔드 API |

---

## 레이아웃 구조 (C-1)

```
┌──────────────────────────────────────────────────────────────┐
│ Header (기존): 로고 │ 테마명 │ 자동저장 ✓ │ 미리보기 │ 게시  │
├──────────┬───────────────────────────────────┬───────────────┤
│ Sidebar  │         StudioCanvas              │ RightPanel    │
│ (240px)  │         (flex-1)                  │ (320px)       │
│ 장르 선택 │  [overview|story|characters|      │  선택된 항목  │
│ 캐릭터 목록│   design|media|advanced]         │  상세 설정     │
│ 단서 목록  │                                   │               │
├──────────┴───────────────────────────────────┴───────────────┤
│ EditorFooter: 유효성 │ 줌 │ L1/L2 레이어 전환                  │
└──────────────────────────────────────────────────────────────┘
```

## 신규 의존 패키지

| 패키지 | 용도 | 도입 PR |
|--------|------|---------|
| `react-hook-form` | 폼 관리 | C-3 |
| `@hookform/resolvers` | zodResolver | C-3 |
| `zod` | ConfigSchema 검증 | C-3 |
| `@xyflow/react` | React Flow (devDep, D에서 사용) | C-1 |
| `jsonlogic-js` | 클라이언트 규칙 평가 | C-1 (설치만) |

## DB 마이그레이션

```sql
-- ClueType enum 확장
ALTER TABLE theme_clues DROP CONSTRAINT IF EXISTS theme_clues_clue_type_check;
ALTER TABLE theme_clues ADD CONSTRAINT theme_clues_clue_type_check
  CHECK (clue_type IN ('evidence','testimony','weapon','alibi','deduction','key_item','red_herring'));

-- category 컬럼 추가
ALTER TABLE theme_clues ADD COLUMN IF NOT EXISTS category VARCHAR(50);

-- genre_presets 테이블 (C-7)
CREATE TABLE genre_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    genre_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    config_defaults JSONB NOT NULL DEFAULT '{}',
    phase_template JSONB NOT NULL DEFAULT '[]',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(genre_id, name)
);
CREATE INDEX idx_genre_presets_genre ON genre_presets(genre_id);
```

## 수용 기준

- [ ] 3-column 레이아웃 (Sidebar/Canvas/RightPanel)
- [ ] 4장르 선택 → ConfigSchema 기반 자동 폼
- [ ] 프리셋 로드 → config_json 기본값 적용
- [ ] Character CRUD (최대 20명)
- [ ] Clue CRUD (최대 200개, 7타입)
- [ ] Auto-save (5s debounce, version 충돌 감지)
- [ ] Client-side Zod + Server-side 검증
- [ ] 기존 EditorLayout 기능 회귀 없음

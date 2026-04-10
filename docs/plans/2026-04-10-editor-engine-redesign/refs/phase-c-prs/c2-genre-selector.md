# PR C-2: GenreSelector + 프리셋 로딩

> Phase C | 의존: C-1 | Wave: W2 (C-3과 병렬)

---

## 목표
장르 선택 UI + 프리셋 로드. 장르별 ConfigSchema를 가져와 에디터에 반영.

## 변경 파일

**신규**
```
apps/web/src/features/editor/
  components/Sidebar/GenreSelector.tsx  # 장르 카드 그리드
  components/Sidebar/PresetList.tsx     # 장르별 프리셋 리스트
  hooks/useGenrePresets.ts             # 프리셋 fetch + apply
```

**수정**
```
apps/web/src/features/editor/
  api.ts                               # genre API types + queries
  components/Sidebar/SidebarPanel.tsx  # GenreSelector 통합
```

## 데이터 타입

```typescript
interface GenreInfo {
  id: string;              // "murder_mystery" | "crime_scene" | "script_kill" | "jubensha"
  name: string;
  description: string;
  icon: string;            // lucide-react 아이콘명
  defaultPlayers: { min: number; max: number };
  defaultDuration: number;
  configSchema: JsonSchema;
  presets: GenrePreset[];
}

interface GenrePreset {
  id: string;
  name: string;            // "빠른 3라운드", "클래식 5라운드"
  description: string;
  configDefaults: Record<string, unknown>;
}
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/v1/editor/genres` | 장르 목록 + ConfigSchema |
| GET | `/v1/editor/genres/{id}/presets` | 장르별 프리셋 |

## UX 흐름

1. 테마 생성 시 / 장르 미설정 → 장르 카드 그리드 (4장르)
2. 장르 선택 → `config_json`에 ConfigSchema 기본값 적용
3. 프리셋 선택 → config_json 덮어쓰기
4. 장르 변경 시 확인 모달 (기존 설정 초기화 경고)

## 테스트

- `GenreSelector.test.tsx`: 4장르 렌더링, 선택, 장르 변경 모달
- `useGenrePresets.test.ts`: fetch, apply, error handling

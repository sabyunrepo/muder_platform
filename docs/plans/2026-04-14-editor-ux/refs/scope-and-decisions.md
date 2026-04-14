# Phase 14.0 — Scope & 7대 결정 상세

> 부모: [../design.md](../design.md)

---

## 1. Scope: B안 — 도메인별 묶음 5 PR

**A안 (기각)**: 기능별 7 PR — PR 수 과다, 리뷰 오버헤드
**B안 (선택)**: 도메인별 5 PR — 관련 기능 묶어 일관성, PR 적절

---

## 2. Architecture: 프론트엔드 only

- 백엔드 `image_service.go` 변경 없음 — 클라이언트 측 요청 수정으로 해결
- `config_json` 내 `character_missions` 구조 확장 (타입별 설정 필드 추가)
- DB 스키마 변경 없음 — config_json은 JSONB 컬럼

---

## 3. Lifecycle: 기존 컴포넌트 리팩터링

- 신규 페이지/라우트 없음
- `SettingsSubTab` 삭제, `ModulesSubTab` 확장
- `CharacterAssignPanel` 이동 (DesignTab → CharactersTab)
- `AssignmentSubTab` 단순화 (inner tab 제거)

---

## 4. External Interface: API 변경 없음

- `imageApi.ts`: `target_id` 빈 문자열 방어 (프론트 수정)
- `uploadImage()`: PNG → WebP 변환으로 크기 최적화
- 기존 API 엔드포인트/응답 형태 불변

---

## 5. Persistence: config_json mission 구조 확장

```typescript
// 기존
interface Mission {
  id: string; type: string; description: string; points: number;
}

// 변경 후
interface Mission {
  id: string;
  type: 'kill' | 'possess' | 'secret' | 'protect';
  description: string;
  points: number;
  // 타입별 설정 (optional)
  targetCharacterId?: string;  // kill, protect
  targetClueId?: string;       // possess, protect
  condition?: string;          // kill(단독/공모), possess(획득조건), protect(위협조건)
  secretContent?: string;      // secret 전용
  penalty?: number;            // secret 발각 패널티
  difficulty?: number;         // secret 난이도 1-5
  quantity?: number;           // possess 수량
}
```

하위호환: 기존 `find/protect/sabotage/observe` 데이터는 새 타입으로 매핑 불필요 —
config_json은 테마별 독립이므로 기존 데이터 영향 없음.

---

## 6. 운영 안전성

- 기존 테스트 유지: `ModulesSubTab.test.tsx`, `SettingsSubTab.test.tsx` 등
- 삭제 파일의 테스트도 삭제 (SettingsSubTab)
- 수정분 테스트 추가: MissionEditor 타입별 설정 렌더링
- 반응형: 수동 QA (viewport 375px, 768px, 1280px)

---

## 7. 도입 전략

- Feature flag 불필요 — UI 리팩터링이므로 즉시 반영
- Wave 3단계 점진 도입:
  - W1: 버그 fix + 반응형 (안전, 기능 변경 최소)
  - W2: UX 개선 (기능 추가/변경)
  - W3: 구조 재편 (의존성 있는 이동/삭제)

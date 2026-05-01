# 01. 아키텍처 — ECS 패턴

> 결정: D-01 — 페이지 분리 + 동적 섹션 모델.
> 대표 mockup: [q2](../mockups/q2-ecs-pattern-mockup.html)

## 결정 사항

- 에디터 = **Entity-Component-System (ECS)** 패턴
- 페이지 두 종류 분리:
  - **모듈 페이지** — 게임 단위 모듈 ON/OFF (글로벌만)
  - **Entity 페이지** — 캐릭터·장소·단서·페이즈·결말 각자 편집
- 모듈 ON 결과 → entity 폼에 **동적 섹션** (Component) 자동 추가
- 모듈 OFF → 그 섹션 사라짐 (회색 빈 자리 X)

## 배경·근거

### 왜 ECS

백엔드는 32 모듈 + 21 ConfigSchema 의 풍부한 표현력 보유. 머더미스터리 도메인 다양성 (라운드별·조합별·즉시 분배 등) 이 이미 모듈 단계에 분화. 에디터가 그 다양성을 따라가려면 한 페이지에 모든 설정 펴는 구조 (단순 폼) 로는 부족.

ECS = "엔티티가 어떤 컴포넌트를 갖느냐에 따라 인스펙터에 다른 필드 노출". 게임 엔진 표준 (Unity 20년 / Godot / Meta Horizon).

### 업계 사례

| 도구 | 적용 |
|------|------|
| Unity Inspector | GameObject 에 Component 추가 → Inspector 폼 동적 변화. 인용: "render values only if the Entity has or not a Component" |
| Godot | "Add Component" 버튼 → 노드 인스펙터 폼 확장 |
| Meta Horizon SpatialFeatures | "ECS 기능을 재사용 가능 모듈로 패키징" — 우리와 동일 어휘 |
| Articy:draft | Template editor: 좌측 features 리스트 + 우측 entity 폼 |

## UX 디테일

### 페이지 분리 원칙

```
┌─────────────────────────────────────┐
│ 🌐 글로벌 시스템 페이지              │
│  카드 클릭 → 모달 (게임 단위 1번)    │
└──────────┬──────────────────────────┘
           │ ON 시 효과 전파
           ▼
┌─────────────────────────────────────┐
│ 👤📍🔍🎬🎭 entity 페이지              │
│  베이스 + Markdown + 동적 섹션       │
└─────────────────────────────────────┘
```

### 동적 섹션 동작

- 모듈 ON → 모든 해당 entity 폼에 그 모듈의 ConfigSchema 폼이 섹션으로 추가
- 사용자가 entity 별 다른 값 입력 (예: 캐릭터 5명 각자 다른 시작 단서)
- 모듈 OFF → 섹션 자체 사라짐. 데이터 보존 vs 삭제 = §미해결

### 시각 구분 (3 색)

mockup q8 의 색 룰:
- 회색 (📋) = 베이스 (항상)
- 노란/금색 (📜📄) = Markdown 컨텐츠 (역할지·발견 시 텍스트·결말)
- 녹색 (🟢) = 동적 모듈 섹션 (켜진 모듈)

## 현재 코드 차용

| 영역 | 기존 코드 | 활용 방식 |
|------|---------|---------|
| 동적 폼 | `apps/web/src/features/editor/components/SchemaDrivenForm.tsx` | ConfigSchema 자동 폼 — 모듈 동적 섹션 렌더링에 재사용 |
| Optimistic | `apps/web/src/hooks/useDebouncedMutation.ts` | Phase 21 #184 통합 훅 — 모든 entity 페이지 mutation 에 적용 |
| Flow | `apps/web/src/features/editor/components/PhaseNodePanel.tsx` (Phase 21 #191 분리) | 페이즈 entity 의 노드 편집에 그대로 |

## 미해결 디테일

- **OFF → ON 데이터 복원**: 모듈 끄면 그 섹션 데이터 삭제? 아카이브? 다시 켜면 복원? → 마이그레이션 phase 에서 결정
- **여러 모듈 동일 키 충돌**: 두 모듈이 같은 entity 필드 요구하면? 도메인 분석 결과 현재는 충돌 없음 (각 모듈이 자기 namespace 사용). 모니터링만.
- **동적 섹션 UI 형태**: 카드 stack vs 아코디언 vs 탭 → §6 미해결 항목 (O-06)

## 참고 mockup

- [q2](../mockups/q2-ecs-pattern-mockup.html) — 페이지 A (모듈 ON/OFF) + 페이지 B (entity 편집 동적 섹션)
- [q8](../mockups/q8-all-modules-on-full-ui.html) — 5 entity 풀 모습 (모든 모듈 ON 가정)

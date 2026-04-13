# Phase 13.0: 게임 설계 에디터 — 비개발자용 설정 UI

## 목표
비개발자가 JSON 편집 없이 게임 설계를 완성할 수 있는 폼 기반 에디터 UI.

## 스코프
| 기능 | 설명 |
|------|------|
| 게임설계 서브탭 | 모듈/흐름/장소/배치/설정 5개 서브탭 구조 |
| ConfigSchema 자동 폼 | 백엔드 모듈 스키마 → 프론트 자동 UI 생성 |
| 맵/장소 관리 | 맵 CRUD + 장소 CRUD (API 이미 존재) |
| 페이즈 타임라인 | 라운드 수, 페이즈 순서/시간 시각적 편집 |
| 단서→장소 배치 | 드래그앤드롭 또는 선택 기반 단서 배치 |
| 캐릭터 배정 | 시작 단서 + 히든 미션 배정 |

## 스코프 외
- React Flow 노드 에디터 (L3)
- 조건부 분기 로직
- 게임 내 시뮬레이션/미리보기

## 아키텍처
v2 설계의 Progressive Disclosure L1 (Template Studio) 채택.
기존 에디터 게임설계 탭을 서브탭으로 분할:
```
게임설계 탭
├── [모듈] — 모듈 토글 (기존 DesignTab)
├── [흐름] — 페이즈/라운드 타임라인
├── [장소] — 맵 + 장소 관리
├── [배치] — 단서→장소, 캐릭터→단서, 캐릭터→미션
└── [설정] — ConfigSchema 자동 폼
```

## 영속성
config_json에 저장:
- phases: 페이즈 배열 (type, duration, rounds, modules)
- clue_placement: { clueId → locationId }
- character_clues: { characterId → [clueId] }
- character_missions: { characterId → [mission] }
- module_configs: { moduleId → config }

## 관련 문서
- v2 설계: docs/plans/2026-04-10-editor-engine-redesign/
- 모듈 스펙: docs/plans/2026-04-05-rebuild/refs/modules/

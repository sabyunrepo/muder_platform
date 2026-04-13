# PR-2: ConfigSchema API + SchemaDrivenForm

## 개요
백엔드 모듈의 ConfigSchema를 프론트에서 읽어 자동 폼 생성.

## scope_globs
- apps/server/internal/domain/editor/handler.go
- apps/server/internal/domain/editor/service.go
- apps/web/src/features/editor/components/design/SettingsSubTab.tsx
- apps/web/src/features/editor/components/SchemaForm.tsx
- apps/web/src/features/editor/api.ts

## 백엔드
1. GET /api/v1/editor/module-schemas → { moduleId: JSONSchema }
2. 각 모듈의 ConfigSchema() 호출하여 JSON Schema 수집
3. engine.Registry에서 모듈별 스키마 추출

## 프론트
1. SchemaForm: JSON Schema → 자동 폼 (string→input, number→slider, boolean→toggle, enum→select)
2. SettingsSubTab: 활성 모듈 목록 → 각 모듈별 SchemaForm 렌더
3. onChange → config_json.module_configs[moduleId] 업데이트

## 테스트
- SchemaForm 각 필드 타입 렌더링
- API 호출 + 폼 표시

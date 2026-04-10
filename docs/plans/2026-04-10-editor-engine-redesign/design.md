# Phase 9.0 — Editor + Engine Redesign (index)

> **상태**: 진행 예정 (2026-04-10)
> **상위 설계**: `docs/superpowers/specs/2026-04-10-editor-engine-redesign/design.md`
> **선행**: Phase 8.0 (superseded) — Session Actor, Hub, Manager 코드 재사용
> **MD 200줄 제한**: 이 index만. PR별 상세는 `refs/` 분할.

---

## 목적

Phase 8.0의 아키텍처 검토 결과를 바탕으로, **Plugin-Backed Schema** 아키텍처로 전환.
비개발자(작가/호스트)가 에디터로 장르별 게임 테마를 직접 제작할 수 있는 플랫폼을 구축.

### Phase 8.0에서 변경되는 핵심 결정

| 항목 | Phase 8.0 | Phase 9.0 | 이유 |
|------|-----------|-----------|------|
| 엔진 구조 | GameProgressionEngine + Module(29개) | GenrePlugin Core + Optional | ISP 준수, 장르 추가 = 기존코드 변경 0 |
| 상태 관리 | Redis snapshot (5s throttle) | PG Audit Log + Redis hot state | 복잡도 감소, 디버깅/복구 유지 |
| 룰 엔진 | 없음 | JSON Logic (클라이언트/서버 동일) | 제작자가 에디터에서 규칙 정의 |
| 에디터 | ConfigJsonTab (JSON 편집) | 3-Layer Progressive Disclosure + React Flow | 비개발자 친화적 |
| 단서 시스템 | 모듈 분산 (6개 모듈) | 통합 ClueGraph + Validator + Visibility | 의존성/조합/위치제한 통합 |
| Phase 8.0 코드 | 갈아엎기 | 점진적 발전 (코드 재사용) | PR-1, PR-2 이미 머지됨 |

---

## Scope

| 카테고리 | 범위 |
|----------|------|
| 백엔드 신규 | GenrePlugin(Core+Optional), PhaseEngine, ClueSystem, AuditLog, RuleEvaluator |
| 백엔드 재사용 | Session Actor, SessionManager, Hub, Client, Router, BaseModuleHandler, LifecycleListener, ReconnectBuffer |
| 프론트엔드 신규 | Editor 3-Layer, React Flow 노드 에디터, SchemaDrivenForm, ClueGraph 뷰, 장르별 GameView |
| 프론트엔드 재사용 | Zustand stores, shared components, ws-client, services |
| Out of scope | gopher-lua 스크립팅, AI-DM, 모바일 에디터, 협업 편집, i18n |

---

## 문서 맵

| 파일 | 내용 |
|------|------|
| [refs/phase-a-engine-core.md](refs/phase-a-engine-core.md) | Phase A: 엔진 코어 (GenrePlugin, PhaseEngine, EventBus, AuditLog) |
| [refs/phase-b-murder-mystery.md](refs/phase-b-murder-mystery.md) | Phase B: 첫 번째 장르 (MurderMystery E2E) |
| [refs/phase-c-editor-l1.md](refs/phase-c-editor-l1.md) | Phase C: 에디터 Layer 1 (Template Studio) — MVP |
| [refs/phase-d-editor-l2.md](refs/phase-d-editor-l2.md) | Phase D: 에디터 Layer 2 (Phase Timeline) |
| [refs/phase-e-editor-l3.md](refs/phase-e-editor-l3.md) | Phase E: 에디터 Layer 3 (Visual Node Editor) |
| [refs/phase-f-crime-scene.md](refs/phase-f-crime-scene.md) | Phase F: 두 번째 장르 (CrimeScene) + 아키텍처 검증 |
| [refs/phase-g-additional.md](refs/phase-g-additional.md) | Phase G: ScriptKill + Jubensha |

---
name: MMP v3 모듈 시스템 설계
description: 29개 게임 모듈 시스템 - BaseModule, ConfigSchema, PhaseReactor, AutoContent, Factory 패턴
type: project
---

**모듈 시스템 핵심:**
- BaseModule + ConfigSchema(선언적 설정) + AutoContent(자동 콘텐츠)
- PhaseReactor(선택적): PhaseAction에 반응하는 모듈만 구현
- Factory 패턴: 세션별 독립 인스턴스 (싱글턴 금지)
- init() + blank import 등록

**29개 모듈 (6 카테고리):**
- Core 4개, Progression 8개, Communication 5개
- Decision 3개, Exploration 4개, Clue Distribution 5개

**PhaseAction 12종:** configJson.phases에서 선언적으로 정의

**게임 엔진:** GameProgressionEngine (3가지 Strategy: Script/Hybrid/Event) + ActionDispatcher

**상세 스펙:** docs/plans/2026-04-05-rebuild/module-spec.md + refs/modules/

**Why:** v2 싱글턴 버그 해결, 모듈=설정 단일 소스로 에디터 자동 UI
**How to apply:** Phase 3(게임엔진 코어) + Phase 5(모듈 이식)에서 구현

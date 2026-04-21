---
name: Phase 13.0 플랜 (게임 설계 에디터)
description: 비개발자용 게임 설계 UI — 서브탭/ConfigSchema폼/맵장소/타임라인/배치/배정 (7 PR, 4 Wave)
type: project
---
Phase 13.0 플랜 준비 완료 — 게임 설계 에디터.

**목표**: JSON 편집 없이 비개발자가 게임 설계를 완성할 수 있는 폼 기반 UI.

**핵심 기능**:
- 게임설계 탭을 5개 서브탭으로 분할 (모듈/흐름/장소/배치/설정)
- ConfigSchema → SchemaDrivenForm 자동 UI 생성
- 맵/장소 CRUD UI (API 이미 존재)
- 페이즈 타임라인 (수평 카드, 프리셋 지원)
- 단서→장소 배치, 캐릭터→단서/미션 배정

**설계 기반**: v2 Progressive Disclosure L1 (Template Studio)
**플랜 경로**: docs/plans/2026-04-13-game-design-editor/
**커밋**: bc793f0

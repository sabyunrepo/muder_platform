---
name: 작업 루틴 강제
description: 매 작업 시작 시 QMD 컨텍스트 로드, 완료 시 문서 업데이트+재인덱싱 필수
type: feedback
originSessionId: 323582ed-c085-474d-bc70-14bba54a7f6b
---
매 작업에 시작/완료 루틴을 강제한다.

**Why:** 작업 중 얻은 지식이 기록되지 않으면 다음 세션에서 활용 불가. QMD 재인덱싱 없으면 검색에 반영 안 됨.

**How to apply:**
- **시작**: Haiku로 QMD search/vector_search → 관련 설계문서+메모리 로드 → 작업 계획
- **완료**: 문서 업데이트 판단 → memory/docs 수정 → PostToolUse hook이 `qmd update` 자동 트리거
- **보고**: 변경 문서 목록 + 인덱싱 결과를 사용자에게 보고
- CLAUDE.md "작업 루틴" 섹션에 명시됨

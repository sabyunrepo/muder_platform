---
name: 마이그레이션 작업 워크플로우
description: Phase별 멀티 페르소나 토론 후 승인 → 구현 → 코드리뷰 → QA 프로세스
type: feedback
---

마이그레이션 작업은 Phase별 다음 프로세스 필수:
1. 세부 작업 계획 작성
2. 멀티 에이전트 비판적 토론 (6 전문가 페르소나)
   - 코드 리뷰어: 구현 품질, 패턴 일관성, 엣지 케이스
   - 디자인/아키텍처 조언자: 구조 설계, 확장성, v3 규칙 적합성
   - 보안 전문가: OWASP, 인증/인가, 입력 검증, 에셋 업로드 보안
   - 성능 전문가: 번들 사이즈, 렌더링 최적화, WebRTC 효율
   - UX 전문가: 사용자 경험, 접근성, 모바일 대응
   - 디자인 전문가: 비주얼 디자인, 컴포넌트 스펙, 인터랙션 마이크로 디자인, AI 슬롭 방지
3. 토론 결과 반영한 최종 계획 확정
4. 사용자 승인 후 구현 착수
5. 코드 리뷰 에이전트
6. QA 에이전트
7. 피드백 반영 → 다음 Phase

## 새 세션에서의 작업 시작 방법

1. **메모리 읽기**: 해당 Phase의 `project_*_plan.md` + `project_*_design.md` 읽기
2. **초안 확인**: 초안이 있으면 그대로 6전문가 토론에 넘기기 (초안은 v2 분석 결과 기반)
3. **6전문가 토론**: 병렬 에이전트 실행 (아키텍트/보안/성능/코드리뷰/UX/디자인)
4. **종합 → 사용자 승인**: 토론 결과를 최종 계획으로 정리, 승인 요청
5. **구현**: 서브태스크별 BE/FE 병렬 에이전트 실행
6. **코드 리뷰 에이전트**: superpowers:code-reviewer로 전체 변경사항 리뷰
7. **리뷰 수정**: Critical/High 이슈 BE/FE 병렬 수정
8. **빌드 확인**: go build + go vet + go test + tsc + vitest
9. **커밋 + PR**: feature branch → push → gh pr create
10. **메모리 업데이트**: phases.md 갱신, 코드 리뷰 교훈 저장

## Phase별 초안 메모리 위치
- Phase B: `project_voice_plan.md` (확정) + `project_voice_design.md` (확정)
- Phase C: `project_phase_c_plan.md` (초안 — 토론 필요)
- Phase E: `project_phase_e_plan.md` (초안 — 토론 필요)

**Why:** 사용자가 비판적 페르소나 기반 토론 + 보안 전문가 포함을 명시적으로 요청.

**How to apply:** 모든 마이그레이션 Phase에서 이 워크플로우를 따를 것. 각 Phase 시작 전 계획+토론 결과를 사용자에게 보여주고 승인 받기.

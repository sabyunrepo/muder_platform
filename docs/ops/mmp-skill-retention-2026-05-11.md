# MMP Skill Surface 정리 (2026-05-11)

## 실행 배경

사용자 요청에 맞춰 MMP 워크플로우에서 사용되는 스킬을  
`기본 Codex 스킬 + MMP 핵심 스킬 + 프론트엔드 디자이너 스킬` 중심으로 정리한다.

- 기본 Codex 스킬: 운영 환경에 기본 탑재되는 표준 스킬/명령 세트로 간주(레포 외부).
- MMP 핵심 스킬: `/.codex/skills`에서 실제 실행 체인에서 남기는 스킬.
- 프론트엔드 디자인: `frontend-design` 계열(필요 시 별도 레포/세션 설정에서 제공).

## 남길 스킬 (Keep)

- `deep-interview`
- `mmp-issue-planning`
- `mmp-pr-lifecycle`
- `mmp-self-improvement-loop`
- `mmp-subagent-orchestration`

## 삭제 대상 후보 (Remove Candidates)

- `mmp-adapter-engine-design`
- `mmp-editor-uzu-briefing`
- `mmp-runner-image-rollout`

### 삭제 근거

- 현재 코드베이스에서 직접 참조되지 않음(AGENTS/스크립트/체크포인트/핵심 워크플로우 경로에서 미사용).
- 핵심 실행 루틴(딥 인터뷰 → 이슈 계획/생성 → PR/CI 루프 → 자가개선/오케스트레이션)에 필수 종속이 아님.

## 실행 체크리스트

- [ ] 삭제 후보 3개 제거
- [ ] 삭제 후 `deep-interview` 라우팅에서 삭제된 스킬 참조 제거
- [ ] 현재 보유 스킬 존재 여부 점검
- [ ] 레퍼런스 무결성 점검 (`rg --files .codex/skills`, `rg -n` 검색)
- [ ] 커밋 메시지 포함: `chore(mmp): prune mmp skill surface`


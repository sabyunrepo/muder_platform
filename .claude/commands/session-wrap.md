# 세션 종료 정리

/clear 전에 실행하여 작업 내용을 메모리에 보존하고 QMD를 재인덱싱합니다.

## 절차

### 1. 작업 내역 수집

먼저 이번 세션의 작업 내역을 파악합니다:
- `git log --oneline` 으로 이번 세션에서 만든 커밋 확인 (오늘 날짜 기준)
- 변경된 주요 파일/기능 영역 파악
- 미완료 작업이 있는지 git status 확인

### 2. 메모리 업데이트

작업 내용에 따라 적절한 메모리 파일을 생성하거나 업데이트합니다:

**메모리 경로**: `~/.claude/projects/-Users-sabyun-goinfre-muder-platform/memory/`

- **새 기능/시스템 구현** → `project_*.md` 파일 생성 (프로젝트 메모리)
- **사용자 피드백/작업 방식 변경** → `feedback_*.md` 파일 생성/업데이트
- **외부 참조 발견** → `reference_*.md` 파일 생성

각 메모리 파일은 frontmatter 포함:
```markdown
---
name: {제목}
description: {한줄 설명}
type: project|feedback|reference
---
{내용}
```

### 3. MEMORY.md 인덱스 업데이트

`~/.claude/projects/-Users-sabyun-goinfre-muder-platform/memory/MEMORY.md` 에 새 메모리 항목 추가.
- 적절한 섹션(프로젝트 정보/도구/작업 방식 등)에 한 줄 추가
- 형식: `- [제목](파일명.md) — 한줄 설명`

### 4. 설계 문서 확인

이번 세션에서 `docs/plans/` 에 새 설계 문서를 추가했다면:
- QMD가 자동 인덱싱할 수 있도록 확인
- `mcp__plugin_qmd_qmd__status` 로 인덱싱 상태 확인

### 5. QMD 재인덱싱 확인

QMD status를 호출하여 문서가 올바르게 인덱싱되었는지 확인합니다:
- `mcp__plugin_qmd_qmd__status` 실행
- mmp-memory, mmp-plans 컬렉션의 문서 수 확인
- needsEmbedding 이 있으면 자동 처리 대기

### 6. 세션 요약 출력

사용자에게 최종 요약을 보여줍니다:

```
## 세션 정리 완료

### 커밋
- {커밋 해시} {커밋 메시지}

### 메모리 업데이트
- {생성/수정한 메모리 파일 목록}

### QMD 상태
- mmp-memory: {N} docs
- mmp-plans: {N} docs

### 미완료 작업
- {있으면 나열, 없으면 "없음"}

/clear 진행해도 됩니다.
```

## 주의사항
- 코드 패턴, 파일 경로 등 코드에서 파악 가능한 정보는 메모리에 저장하지 않음
- git history로 알 수 있는 정보도 저장하지 않음
- 놀라운/비명시적 결정사항만 메모리에 보존
- MEMORY.md 200줄 제한 — 간결하게 유지

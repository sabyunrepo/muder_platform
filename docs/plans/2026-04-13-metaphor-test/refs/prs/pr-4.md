# PR-4 — 메타포 템플릿 + 테마 시드

**Wave**: 3 · **Parallel**: ×1 · **Depends on**: PR-1, PR-2 · **Branch**: `feat/metaphor-template`

## Context
메타포 6인 JSON 프리셋 생성 + 에디터에서 테스트할 수 있는 시드 데이터.

## Tasks

### T1: JSON 템플릿
- [ ] `internal/template/presets/murder_mystery/metaphor_6p.json` — 13 페이즈 + 14 모듈 설정
- [ ] 템플릿 로더 테스트 통과 확인

### T2: DB 시드 스크립트
- [ ] `db/seed/metaphor.sql` 또는 Go 시드 코드
- [ ] 6 캐릭터 (저스티스 포함)
- [ ] 장소 4개 + 장소별 단서 (1차/2차)
- [ ] 아이템 단서 2개 (peek 효과)
- [ ] 히든 미션 6개 (캐릭터당 1개)
- [ ] 리딩 섹션 (프롤로그, 오프닝, 시크릿카드)

### T3: 검증
- [ ] Go 빌드 + 템플릿 로더 테스트
- [ ] 시드 실행 후 에디터에서 테마 확인

## scope_globs
- `apps/server/internal/template/presets/murder_mystery/metaphor_6p.json`
- `apps/server/db/seed/**`

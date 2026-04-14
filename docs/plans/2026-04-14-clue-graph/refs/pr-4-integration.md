# PR-4: 통합 + E2E

> Wave 3 | 의존: PR-2, PR-3 | Branch: `feat/phase-17.5/PR-4`

## 목표

전체 파이프라인 통합 확인 + E2E 테스트 + UX 폴리시.

## 수정 대상

| 파일 | 변경 |
|------|------|
| 신규 `e2e/clue-relation.spec.ts` | Playwright E2E |
| 수정 `components/clues/ClueRelationGraph.tsx` | 폴리시 (에러 롤백 등) |

## Tasks

### Task 1: E2E 테스트
- 에디터 → 단서 탭 → 관계 서브탭 이동
- 단서 노드 표시 확인
- 관계 엣지 추가 (onConnect) → 서버 저장 확인
- 관계 엣지 삭제 → 서버 반영 확인

### Task 2: UX 폴리시
- cycle 감지 시 엣지 추가 롤백 (optimistic → revert)
- 에러 토스트 "순환 참조가 감지되어 관계를 추가할 수 없습니다"
- 빈 상태 UI "단서를 먼저 추가하세요"
- 로딩 스피너

### Task 3: Playwright 시각 점검
- 관계 그래프 스크린샷 확인
- AND/OR 엣지 시각 차별화 확인
- 검증 → ValidationPanel 표시 확인

## 검증
- [ ] E2E 테스트 통과
- [ ] cycle 추가 시도 → 롤백 + 에러
- [ ] Playwright 시각 정상
- [ ] `pnpm test` + `go test` pass

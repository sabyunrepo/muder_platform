# Issue #249 — 결말/투표 결과 breakdown 및 종료 화면 연결

## 원인

Uzu의 감상 공유 화면은 토론·투표·엔딩 이후 플레이어가 결과를 다시 읽고 공유할 수 있는 마지막 화면이다. 특히 표시할 투표 결과를 선택하고, 엔딩 내용을 감상 공유 탭에 연결하는 흐름이 있다.

MMP는 이를 그대로 복제하지 않는다. MMP는 실시간 멀티플레이어 runtime이 있으므로, 종료 화면은 프론트가 임의로 계산하지 않고 백엔드 Engine이 확정한 `voting.lastResult`와 `ending_branch.result`를 읽어야 한다.

## 결과

이번 PR의 목표는 “종료 화면이 믿고 읽을 수 있는 최소 결과 계약”을 만든다.

- 투표 결과는 총 투표 수, 참여율, 기권 수, 동률 후보, 결과 상태를 포함한다.
- 비밀 투표의 개별 투표 내역은 계속 숨기고, 종료 화면에는 집계 결과만 공개한다.
- 결말 분기 점수는 admin/all-state에서는 전체 score를 보존하되, player-aware state에서는 자신의 점수만 보여준다.
- 프론트는 internal ID나 raw JSON이 아니라 제작자/플레이어가 이해하는 문장형 요약으로 표시한다.

## 권장 구현 범위

1. Backend Engine
   - `voting.VoteResult`에 결과 breakdown 필드 추가
   - `voting.BuildStateFor`에 `lastResult` 집계 노출
   - `voting.SaveState/RestoreState`에 `lastResult` 포함해 재접속/복구 후에도 종료 화면 유지
   - `ending_branch.BuildState`는 전체 score, `BuildStateFor`는 `myScore`만 노출

2. Frontend Adapter/UI
   - `resultBreakdownAdapter`가 backend module state를 결과 화면 ViewModel로 변환
   - `ResultBreakdownPanel`이 RESULT phase에서 공통 결말과 투표 요약을 표시
   - 모바일/데스크톱 모두 세로 카드 흐름으로 구성

3. 후순위
   - 캐릭터별 별도 엔딩 본문 편집 UI
   - 감상 공유 탭 편집 UI
   - GM override / 수동 결과 보정
   - 투표 결과를 여러 개 선택해 공개하는 제작자 UI

## 완료 조건

- Go focused test: `go test ./internal/module/decision/voting ./internal/module/decision/ending_branch`
- Front focused test: `vitest resultBreakdownAdapter + ResultBreakdownPanel`
- TypeScript typecheck
- `git diff --check`

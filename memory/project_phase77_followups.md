---
name: Phase 7.7 후속 작업 목록
description: Phase 7.7 FE 머지(2026-04-07, PR #10 52fd23e) 이후 남은 cleanup/integration/medium-severity 이슈들
type: project
---

## 🔴 통합 필수 (Phase 8 또는 별도)

### 1. 엔진 세션 매니저 + ReadingWSHandler wiring
- **파일**: `apps/server/cmd/server/main.go`
- **상태**: `ReadingWSHandler`와 `ReadingSessionResolver`는 interface로 준비돼 있으나 실제 wiring 없음. 이는 Phase 7.5/7.6/7.7에서 pre-existing 상태.
- **필요 작업**:
  1. `ReadingSessionResolver` 구현체 작성 (세션별 ReadingModule 조회, playerID → 역할/호스트 여부 해결, sectionID lookup)
  2. `main.go`에서 `wsRouter.Register("reading", handler.Handle)` 등록
  3. WS Hub disconnect/reconnect 훅에 `OnPlayerLeft`/`OnPlayerRejoined` 연결
  4. per-session EventBus 구독 → `ForwardEvent(sessionID, type, payload)` 호출
  5. PhaseAction `start_reading_section` 경로에서 `sectionID`를 `ReadingModule.Init` config에 주입

**영향**: 이 wiring 없이는 리딩 WS 이벤트가 실제 end-to-end로 작동하지 않음. FE는 정확한 wire protocol을 따르지만 서버가 이벤트를 발행할 진입점이 없음.

### 2. AudioManager → audioGraph.sfx 연결
- **파일**: `apps/web/src/features/audio/AudioManager.ts` + `AudioProvider.tsx`
- **상태**: 기존 AudioManager는 private masterGain → destination 유지. `audioGraph.getGainNode("sfx")` 채널은 할당만 되고 연결 안 됨. 볼륨 mirroring으로 두 경로가 동기화돼 있어 UX상으로는 작동.
- **필요 작업**: AudioManager가 BgmManager/VoiceManager처럼 graph를 주입받고 source → `graph.getGainNode("sfx")`로 연결하도록 리팩토링. 기존 AudioBufferSourceNode LRU 캐시 패턴 유지.

### 3. `@mmp/ws-client` 빌드 실패
- **증상**: `pnpm build` — "Failed to resolve entry for package '@mmp/ws-client'"
- **상태**: Phase 7.7 이전부터 pre-existing
- **필요 작업**: 워크스페이스 패키지 빌드 순서 또는 export 필드 설정 확인 필요

### 4. E2E Playwright (Phase 8 이월)
- **상태**: Phase 7.7 범위에서 제외됨. Phase H 12 스펙 계획서에 있으나 미착수.
- **필요 작업**: Phase 8 통합 QA에서 Playwright 셋업 + 리딩/미디어/컷신 시나리오

---

## 🟡 Medium-Severity Review Findings (머지 후 cleanup)

### 오디오 (`apps/web/src/features/audio/`)

- **M-audio-1**: `BgmManager.ts` — `linearRampToValueAtTime` → `setTargetAtTime` 또는 `exponentialRampToValueAtTime` 변경. 볼륨 곡선이 로그여야 perceptual하게 균등. 현재는 non-uniform crossfade.
- **M-audio-2**: `BgmManager.ts` pause/resume이 mid-crossfade 상태 무시. 두 슬롯 모두 trackId가 있는 동안 resume 호출 시 양쪽 재생 (audible double-playback) 가능. 수정: `activeIdx` 기반으로 현재 재생 중인 슬롯만 pause/resume.
- **M-audio-3**: `AudioOrchestrator.ts` 동시 `handleSetBgm` 호출 시 race — A가 `await load()` 중일 때 B가 도착하면 활성 상태 체크를 통과하지 못해 이전 플레이어를 leak. 수정: in-flight load 토큰 + 취소.
- **M-audio-4**: R2 CORS 헤더 미설정 시 `crossOrigin="anonymous"` 사용한 `<audio>`가 Web Audio 그래프를 거치면 silent fail (tainted source). 진단 로그 추가 또는 R2 CORS 필수 요구사항 docs에 기록.

### 비디오 (`apps/web/src/features/media/`)

- **M-video-1**: `VideoOrchestrator.playCutscene` 2회 호출 시 silently ignored. `CutsceneModal`이 무시된 시도를 감지 못함. 수정: `{status: "ignored" | "started"}` 반환 또는 throw.
- **M-video-2**: `VideoOrchestrator` race — `await player.load` 도중 dispose 호출 시 `currentPlayer === player && !endedHandled` 체크 없음. 취소 토큰 필요.
- **M-video-3**: `CutsceneModal` Escape 키 / focus trap / focus restore 누락 (접근성).
- **M-video-4**: `EvidenceVideoCard` `createVideoPlayer("FILE")` throw 시 컴포넌트 크래시. try/catch + fallback UI 필요.
- **M-video-5**: `mediaApi.uploadMediaFile` 재시도 루프가 모든 에러에 재시도 (403/401/413도). `defaultPutFile` 에러에 `.status` 속성 추가해 구분 필요. Abort 시 `confirmUpload` 건너뛰기도 필요.

### 에디터

- **M-edit-1**: `MediaDetail.tsx` `window.alert`/`window.confirm` 사용 (sonner 토스트 또는 AlertDialog로 교체 권장).
- **M-edit-2**: `YouTubeAddModal.tsx` oEmbed 썸네일 로드 실패 시 fallback 없음 (hqdefault → default → icon). `onError` 핸들러 추가.

### 리딩

- **M-read-1**: `isValidAdvanceBy` (editor + backend) `role: ` whitespace 허용. trimmed 체크 필요.
- **M-read-2**: `ReadingLineRow.handleVoiceClear` — speaker 변경으로 advanceBy가 이미 `""`로 reset된 후 voice clear 시 recompute 안 됨. low-impact 엣지 케이스.
- **M-read-3**: `ReadingSectionEditor` "되돌리기/Discard" 버튼 없음. 현재는 conflict-refresh 또는 섹션 collapse만 가능.
- **M-read-4**: `readingStore.showLine` out-of-range 시 dev 경고 로그 추가.
- **M-read-5**: `readingStore.getCurrentLine` idle 처리가 completed와 불일치. 정리.

### 백엔드

- **M-be-1**: `ReadingModule.BuildState()` (engine.Module 인터페이스)가 `status`, `pausedReason` 포함 안 함. 엔진 스냅샷 복원 시 paused state 소실.
- **M-be-2**: `ReadingModule.currentLineIndex >= totalLines-1` 완료 체크가 중복 발행 가능 (reading.completed + line_changed 둘 다). 테스트 없음.
- **M-be-3**: `MediaReferenceInfo` 에러 코드 매핑 `ErrMediaReferenceInUse` → `ErrCodeBadMessage` (ErrCodeConflict 없어서) — forward-safety 용. ErrCodeConflict 정의 필요.
- **M-be-4**: `ReadingModule.HandleAdvance` status=paused 시 호스트 수동 advance 허용 여부 불명확. 테스트로 명시.

---

## 🟢 Low / Info (선택적)

- `BgmManager` dispose + timer 정리는 이미 e5a037c에서 수정됨
- `YouTubePlayer` 리스너 버퍼링은 이미 62ceffe에서 수정됨
- `TypewriterEffect` onComplete ref는 이미 34aa6cd에서 수정됨
- `VideoPlayer` 인터페이스에 seek/mute/loop 없음 — Phase 7.7 범위에서 OK, Phase 7.8+ 추가 가능
- `FileVideoPlayer` ctor throw vs load throw 패턴 일관성 — 현재 ctor에서 throw

---

## 🔵 다음 세션 시작 시 체크리스트

**Clear 후 새 작업 시작할 때 이 파일과 `project_phases.md`를 먼저 확인:**

1. Phase 7.8 착수? → `docs/plans/2026-04-05-rebuild/checklist.md` Phase 7.8 섹션 읽기
2. Phase 8 통합 QA 착수? → 위 "통합 필수" 항목 1번 (엔진 wiring)부터
3. Phase 7.7 cleanup만 할 경우 → 위 Medium 이슈 중 우선순위 (audio-2 pause/resume, video-3 접근성, read-3 Discard 버튼 정도가 사용자 영향 큼)

## Why
Phase 7.7 머지 직전 코드 리뷰에서 발견한 CRITICAL + HIGH는 모두 수정됐지만 MEDIUM/LOW는 의도적으로 머지 후로 미뤘음. 컨텍스트 손실 없이 나중에 이어서 작업하려면 이 목록이 필요.

## How to apply
새 세션에서 "Phase 7.7 후속 작업" 또는 "엔진 wiring" 언급 시 이 파일을 먼저 읽고 우선순위에 따라 진행.

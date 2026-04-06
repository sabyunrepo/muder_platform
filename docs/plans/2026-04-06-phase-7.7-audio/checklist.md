# Phase 7.7 오디오/미디어 — 구현 체크리스트

> 설계: `design.md` | 결정 근거: `context.md`

---

## Step 1: DB + Storage (백엔드 기반)

- [ ] 1.1 Migration 00015_theme_media.sql (테이블 + 인덱스 + CHECK)
- [ ] 1.2 sqlc 쿼리 media.sql (10+ 쿼리) + codegen
- [ ] 1.3 storage.Provider 인터페이스 (infra/storage/provider.go)
- [ ] 1.4 R2 구현 (infra/storage/r2.go) — GenerateUploadURL, GenerateDownloadURL, HeadObject, Delete
- [ ] 1.5 MediaService 구현 — RequestUpload, Confirm, YouTube, Update, Delete, List
- [ ] 1.6 미디어 핸들러 6개 (editor/handler.go 확장) + 라우트 등록
- [ ] 1.7 YouTube oEmbed 조회 + URL 화이트리스트 (SSRF 방지)
- [ ] 1.8 파일 검증 — magic bytes (MP3/OGG/WAV) + 용량 20MB
- [ ] 1.9 리소스 제한 — 테마 100개/500MB, 유저 2GB, rate limit 10/min
- [ ] 1.10 에러 코드 7개 (apperror/codes.go)
- [ ] 1.11 Orphan 정리 asynq 작업 (media:cleanup, 매시간)
- [ ] 1.12 Go 테스트 (서비스 + 핸들러)

## Step 2: 게임 엔진 확장

- [ ] 2.1 engine/types.go — ActionStopAudio 추가
- [ ] 2.2 engine/types.go — PhaseConfig.bgmId, ReadingSectionConfig, GameConfig.mediaAssets, MediaAsset
- [ ] 2.3 module/media/audio.go — AudioModule PhaseReactor (ReactTo, EventBus 구독)
- [ ] 2.4 module/register.go — media blank import
- [ ] 2.5 engine/engine.go — enterCurrentPhase bgmId 자동 SET_BGM 주입
- [ ] 2.6 module/progression/reading.go — Lines/BGMId config, voiceId 발행, voice_ended 핸들러
- [ ] 2.7 engine/validation.go — 미디어 참조 유효성 검증 (bgmId, onEnter/onExit mediaId)
- [ ] 2.8 ws/router.go — audio 네임스페이스 등록
- [ ] 2.9 Go 테스트 (AudioModule + ReadingModule 확장 + validation)

## Step 3: 프론트엔드 오디오

- [ ] 3.1 layers/BgmManager.ts — HTMLAudioElement 듀얼 슬롯, 크로스페이드 2초, 루프
- [ ] 3.2 layers/VoiceManager.ts — HTMLAudioElement 순차 재생, onended 이벤트
- [ ] 3.3 layers/YouTubePlayer.ts — YT.Player 래퍼, setInterval 페이드, 루프
- [ ] 3.4 AudioOrchestrator.ts — 3레이어 합성 facade
- [ ] 3.5 AudioManager.ts 수정 — getGainNode() 추가
- [ ] 3.6 audioStore.ts 확장 — voiceVolume, reading 상태, BGM Ducking
- [ ] 3.7 hooks/useAudioEvents.ts — WS 이벤트 구독 (set_bgm, play_media, stop, reading)
- [ ] 3.8 AudioProvider.tsx — Orchestrator 생성, 4채널 동기화
- [ ] 3.9 SoundControl.tsx — 4채널 슬라이더 (master/bgm/voice/sfx)
- [ ] 3.10 types.ts 확장 — MediaPlayPayload, BgmSetPayload 등
- [ ] 3.11 audioContext.ts — HTMLAudioElement 워밍업 (iOS Safari)
- [ ] 3.12 packages/shared/src/ws/types.ts — audio/reading WS 이벤트 타입

## Step 4: 에디터 미디어 탭

- [ ] 4.1 constants.ts — EDITOR_TABS에 media, endings 추가 (5→7)
- [ ] 4.2 MediaTab.tsx — 좌 사이드바 목록 + 우 상세/업로드
- [ ] 4.3 MediaToolbar.tsx — 검색 + 필터 칩 (BGM/SFX/VOICE)
- [ ] 4.4 MediaCard.tsx — TypeBadge + 이름 + 길이 + 인라인 재생
- [ ] 4.5 MediaDetail.tsx — 이름 편집 + WaveformPlayer + 삭제
- [ ] 4.6 MediaUploadPane.tsx — DropZone + YouTube URL 입력
- [ ] 4.7 WaveformPlayer.tsx — audio + 프로그레스바 + 재생/정지
- [ ] 4.8 MediaPicker.tsx (shared) — 공용 미디어 선택 모달
- [ ] 4.9 React Query 훅 — useEditorMedia, useUploadMedia, useDeleteMedia
- [ ] 4.10 EditorLayout.tsx — MediaTab lazy import + TabContent 분기

## Step 5: 리딩 UI

- [ ] 5.1 ReadingOverlay.tsx — 하단 고정 오버레이 (z-40, max-w-2xl)
- [ ] 5.2 ReadingLine.tsx — 화자 이름 + TypewriterEffect (40ms/글자)
- [ ] 5.3 hooks/useTypingEffect.ts — 타이핑 애니메이션 훅 + reduced-motion 존중
- [ ] 5.4 ReadingControls.tsx — advanceMode 3종 (gm/auto/player)
- [ ] 5.5 GamePage 통합 — ReadingOverlay 조건부 렌더 (reading !== null)
- [ ] 5.6 Voice 연동 — lineIndex 변경 → orchestrator.playVoiceLine
- [ ] 5.7 reading:voice_ended WS 전송 (auto 모드)

## Step 6: 통합 테스트

- [ ] 6.1 Go 전체 테스트 PASS
- [ ] 6.2 FE Vitest 테스트 (audioStore, SoundControl, MediaTab, ReadingOverlay)
- [ ] 6.3 TypeScript 0 errors
- [ ] 6.4 수동 E2E: 업로드 → 에디터 미디어 목록 → 게임 BGM 재생 → 리딩 UI
- [ ] 6.5 모바일 테스트: iOS Safari autoplay, 백그라운드 탭

---

**진행:** 2026-04-06 설계 완료. 구현 미착수.

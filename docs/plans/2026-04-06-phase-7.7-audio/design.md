# Phase 7.7 오디오/미디어 — 설계 문서

> 6전문가 토론 종합 (backend-architect, frontend-architect, audio-engineer, game-engine-expert, ux-designer, infra-security)

---

## 1. 개요

Phase 7.7은 게임 내 오디오 시스템을 완성한다. 기존 SFX 전용 AudioManager를 3레이어(BGM/Voice/SFX)로 확장하고, 테마 에디터에 미디어 라이브러리 탭을 추가하며, 리딩(대사) UI를 구현한다.

### 완료 기준
- theme_media DB + CRUD API + R2 Presigned URL 업로드
- AudioOrchestrator: BGM 크로스페이드 2초 + Voice 순차 재생 + SFX (기존)
- YouTube IFrame API BGM 지원
- 에디터 미디어 탭 + MediaPicker 공용 컴포넌트
- 리딩 UI (ReadingOverlay) + advanceMode 3종 (gm/auto/player)
- PhaseAction 확장 (STOP_AUDIO) + 페이즈별 BGM 자동 전환
- SoundControl 4채널 (master/bgm/voice/sfx)

---

## 2. 백엔드

### 2.1 DB 스키마 (Migration 00015)

```sql
CREATE TABLE theme_media (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_id    UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    type        VARCHAR(10) NOT NULL,
    source_type VARCHAR(10) NOT NULL,
    url         TEXT,
    storage_key TEXT,
    duration    INT,
    file_size   BIGINT DEFAULT 0,
    mime_type   VARCHAR(50),
    tags        TEXT[] NOT NULL DEFAULT '{}',
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_media_type CHECK (type IN ('BGM', 'SFX', 'VOICE')),
    CONSTRAINT valid_source_type CHECK (source_type IN ('FILE', 'YOUTUBE')),
    CONSTRAINT file_requires_storage CHECK (
        source_type != 'FILE' OR (storage_key IS NOT NULL AND mime_type IS NOT NULL)
    ),
    CONSTRAINT youtube_requires_url CHECK (
        source_type != 'YOUTUBE' OR url IS NOT NULL
    )
);

CREATE INDEX idx_theme_media_theme ON theme_media(theme_id);
CREATE INDEX idx_theme_media_type ON theme_media(theme_id, type);
```

- bgmId는 configJson JSONB 내 필드 (FK 아닌 앱 레벨 검증 — 기존 패턴)
- phases[].bgmId, phases[].readingSection.bgmId → ValidateTheme에서 참조 무결성 검증

### 2.2 sqlc 쿼리 (queries/media.sql)

- `ListMediaByTheme`, `ListMediaByThemeAndType`, `GetMedia`, `CreateMedia`
- `UpdateMedia`, `DeleteMedia`, `CountMediaByTheme`
- `GetMediaWithOwner` (소유권 검증 JOIN), `DeleteMediaWithOwner`
- `SumMediaSizeByTheme`, `SumMediaSizeByCreator` (리소스 제한)
- `ListMediaByIDs` (configJson 참조 검증용)

### 2.3 Storage Provider (infra/storage/)

```go
type Provider interface {
    GenerateUploadURL(ctx context.Context, key, contentType string, maxSize int64) (string, error)
    GenerateDownloadURL(ctx context.Context, key string, expiry time.Duration) (string, error)
    HeadObject(ctx context.Context, key string) (*ObjectMeta, error)
    DeleteObject(ctx context.Context, key string) error
    DeleteObjects(ctx context.Context, keys []string) error
}
```

- 구현: `r2.go` — AWS SDK v2 S3 호환 클라이언트
- 버킷 구조: `themes/{theme_id}/media/{uuid}.{ext}`
- **Private 버킷** + Signed Download URL (15분 TTL) — 유료 테마 에셋 보호

### 2.4 업로드 플로우 (Presigned URL 2-step)

```
Client → POST /editor/themes/:id/media/upload-url  (메타: name, type, mime, size)
Server → 검증 + Presigned PUT URL 생성 (5분 TTL) + pending 레코드
Client → PUT presigned URL (파일 직접 R2 업로드)
Client → POST /editor/themes/:id/media/confirm     (uploadId)
Server → HeadObject 검증 + magic bytes 검증 → theme_media 레코드 활성화
```

### 2.5 MediaService (editor/service.go 확장)

```go
// Service 인터페이스에 추가
RequestMediaUpload(ctx, creatorID, themeID, req) (*UploadURLResponse, error)
ConfirmMediaUpload(ctx, creatorID, themeID, uploadID) (*MediaResponse, error)
CreateMediaYouTube(ctx, creatorID, themeID, req) (*MediaResponse, error)
UpdateMedia(ctx, creatorID, mediaID, req) (*MediaResponse, error)
DeleteMedia(ctx, creatorID, mediaID) error
ListMedia(ctx, creatorID, themeID, mediaType *string) ([]MediaResponse, error)
GetMediaPlayURL(ctx, sessionID, mediaID, playerID) (string, error)
```

### 2.6 REST API

| Method | Path | 설명 |
|--------|------|------|
| POST | `/editor/themes/:id/media/upload-url` | Presigned URL 요청 |
| POST | `/editor/themes/:id/media/confirm` | 업로드 완료 확인 |
| POST | `/editor/themes/:id/media/youtube` | YouTube URL 등록 |
| GET | `/editor/themes/:id/media` | 미디어 목록 (?type=BGM) |
| PATCH | `/editor/media/:id` | 미디어 수정 |
| DELETE | `/editor/media/:id` | 미디어 삭제 |

### 2.7 YouTube oEmbed

- 고정 엔드포인트: `https://www.youtube.com/oembed?url=...&format=json`
- URL 화이트리스트: youtube.com, youtu.be (HTTPS 필수)
- SSRF 방지: 리다이렉트 차단, 5초 타임아웃
- duration: oEmbed 미제공 → 클라이언트 IFrame API에서 감지 후 PATCH로 보고

### 2.8 보안

- **파일 검증**: Magic bytes (MP3: FF FB/ID3, OGG: OggS, WAV: RIFF+WAVE)
- **용량**: 파일당 20MB, 테마당 100개 / 500MB, 유저당 2GB
- **Rate Limit**: 업로드 분당 10회, 동시 3개
- **소유권**: getOwnedTheme() 패턴 (404 반환, 정보 노출 방지)
- **Orphan 정리**: asynq 매시간 — R2 vs DB 비교, 30분 경과 orphan 삭제

### 2.9 에러 코드

| Code | HTTP | 설명 |
|------|------|------|
| `MEDIA_INVALID_TYPE` | 422 | magic bytes 불일치 |
| `MEDIA_INVALID_URL` | 400 | YouTube URL 검증 실패 |
| `MEDIA_TOO_LARGE` | 400 | 20MB 초과 |
| `MEDIA_LIMIT_EXCEEDED` | 429 | 테마당 100개 초과 |
| `MEDIA_STORAGE_FULL` | 429 | 500MB/2GB 초과 |
| `MEDIA_UPLOAD_EXPIRED` | 400 | presigned URL 만료 후 confirm |
| `MEDIA_OEMBED_FAILED` | 502 | YouTube oEmbed 실패 |

---

## 3. 게임 엔진 통합

### 3.1 PhaseAction 확장

`engine/types.go`에 이미 선언됨: `PLAY_SOUND`, `PLAY_MEDIA`, `SET_BGM`
**추가**: `ActionStopAudio PhaseAction = "STOP_AUDIO"`

`dispatcher.go`의 `ActionRequiresModule`에 등록하지 않음 — module-independent 액션으로 broadcastAction() 경유.

### 3.2 AudioModule (module/media/audio.go)

새 PhaseReactor 모듈:
- `SupportedActions()`: PLAY_MEDIA, SET_BGM, STOP_AUDIO
- `ReactTo()`: EventBus로 audio 이벤트 발행
- EventBus 구독: `reading.line_changed` → voice 재생 지시, `reading.completed` → 페이즈 BGM 복귀
- `phaseBGMId` 1단계 스택으로 리딩 BGM 오버라이드 관리

### 3.3 페이즈 BGM 자동 전환

`engine.go enterCurrentPhase()` 수정:
- `PhaseConfig.bgmId` 있으면 onEnter 앞에 SET_BGM 자동 dispatch
- onEnter의 수동 SET_BGM으로 오버라이드 가능 (호환성)

### 3.4 ReadingModule 확장

- `readingConfig`에 `Lines []readingLineConfig` + `BGMId string` 추가
- `reading.line_changed` 이벤트에 `voiceId` 포함
- `reading:voice_ended` WS 메시지 → advanceMode=auto 시 자동 advance
- 서버는 "무엇을 재생하라" 지시만, 실제 오디오는 100% 클라이언트

### 3.5 configJson 스키마 확장

```go
type PhaseConfig struct {
    // ... 기존 필드
    BGMId          string               `json:"bgmId,omitempty"`
    ReadingSection *ReadingSectionConfig `json:"readingSection,omitempty"`
}

type GameConfig struct {
    // ... 기존 필드
    MediaAssets []MediaAsset `json:"mediaAssets,omitempty"`
}
```

- `validation.go`에 미디어 참조 유효성 검증 추가 (bgmId, onEnter/onExit의 mediaId)

### 3.6 WS 이벤트

| 이벤트 | 방향 | Payload |
|--------|------|---------|
| `audio:play_media` | S→C | `{mediaId, sourceType, url, layer}` |
| `audio:set_bgm` | S→C | `{mediaId, sourceType, url, fadeMs}` |
| `audio:stop` | S→C | `{layer: "bgm"\|"voice"\|"all"}` |
| `audio:play_voice` | S→C | `{voiceId, url}` |
| `reading:voice_ended` | C→S | `{lineId}` |

---

## 4. 프론트엔드

### 4.1 AudioOrchestrator 아키텍처

기존 SFX AudioManager를 유지하면서 상위 facade로 3레이어 합성:

```
AudioOrchestrator (features/audio/AudioOrchestrator.ts)
├── SfxManager    (기존 AudioManager — 변경 최소: getGainNode 추가)
├── BgmManager    (layers/BgmManager.ts — FILE + YouTube)
└── VoiceManager  (layers/VoiceManager.ts — HTMLAudioElement 순차)
```

### 4.2 Web Audio 그래프

```
[SFX 0..3] BufferSource → sfxGainN → sfxLayerGain ─┐
[BGM A] MediaElement → bgmGainA ─┐                  │
[BGM B] MediaElement → bgmGainB ─┴─ bgmLayerGain ──┼─ masterGain → destination
[Voice] MediaElement ──────────── voiceGain ─────────┘
[YouTube] (iframe, setVolume 독립 — Web Audio 외부)
```

### 4.3 BGM 크로스페이드 (2초)

- `HTMLAudioElement` + `createMediaElementSource()` — 스트리밍, 메모리 효율
- 듀얼 슬롯 (A/B) 교대: 활성 fadeOut + 비활성 fadeIn (`linearRampToValueAtTime`)
- YouTube: setInterval 기반 소프트웨어 페이드 (50ms 단위)
- 크로스페이드 중 새 요청 시 `cancelScheduledValues` 필수

### 4.4 Voice 레이어

- `HTMLAudioElement` 사용 (스트리밍, 메모리 효율)
- `onended` → 다음 라인 or reading:line_completed
- BGM Ducking: voice 재생 중 BGM 30%로 감소 (0.5초 fade)
- advanceMode=auto: voice 끝 + delay → `reading:voice_ended` 전송

### 4.5 YouTube IFrame API

- `layers/YouTubePlayer.ts` — YT.Player 래퍼
- 숨김 iframe (1px, overflow hidden)
- 볼륨: `player.setVolume(bgmVolume * masterVolume * 100)`
- 루프: `onStateChange ENDED → seekTo(0) + playVideo()`
- 모바일: `playsinline: 1`, 백그라운드 탭 시 자동 일시정지 대응

### 4.6 audioStore 확장 (Zustand)

```typescript
interface AudioState {
  masterVolume: number;    // 0.8
  bgmVolume: number;       // 0.6
  voiceVolume: number;     // 1.0 (NEW)
  sfxVolume: number;       // 0.7
  isMuted: boolean;
  // 휘발성 (localStorage 미저장)
  currentBgmId: string | null;
  isVoicePlaying: boolean;
  reading: ReadingState | null;
}
```

- 볼륨 + mute만 localStorage 영속화
- 재생 상태는 서버 session:state에서 재동기화

### 4.7 모바일/브라우저 호환성

- iOS Safari: 최초 제스처 시 AudioContext.resume + HTMLAudioElement 워밍업 (muted play+pause)
- 백그라운드 탭: BGM 유지, SFX 스킵(기존), Voice 일시정지 (복귀 시 재개)
- AudioContext statechange: suspended → 복원 처리

### 4.8 메모리 전략

| 리소스 | 전략 | 최대 |
|--------|------|------|
| SFX (AudioBuffer) | LRU 20개 (기존) | ~10MB |
| BGM (HTMLAudioElement) | 스트리밍, 2개 element 풀 | ~수 MB |
| Voice (HTMLAudioElement) | 스트리밍, 1개 재사용 | ~수 MB |
| YouTube | IFrame 1개 | 브라우저 관리 |

---

## 5. 에디터 미디어 탭

### 5.1 탭 확장 (5 → 7)

EDITOR_TABS에 추가: `media` (Music 아이콘), `endings` (Flag 아이콘)

### 5.2 MediaTab 레이아웃

DesignTab 패턴 차용 (좌 w-60 사이드바 + 우 flex-1 콘텐츠):
- **상단**: 검색바 + 필터 칩 (BGM/SFX/VOICE/전체)
- **좌측**: MediaCard 목록 (TypeBadge, 이름, 길이, 인라인 ▶)
- **우측 (선택 시)**: 상세 정보 + WaveformPlayer + 삭제
- **우측 (미선택)**: DropZone 업로드 + YouTube URL 입력

### 5.3 MediaPicker (shared/components/)

모달 팝업. 다른 탭에서 미디어 선택 시 사용:
- props: `{ open, onClose, onSelect, defaultFilter?, selectedId? }`
- 3열 그리드 + 필터 + 미리듣기 + 선택 확인

### 5.4 TypeBadge 색상

| 타입 | 색상 |
|------|------|
| BGM | `bg-amber-500/10 text-amber-400` |
| SFX | `bg-emerald-500/10 text-emerald-400` |
| VOICE | `bg-sky-500/10 text-sky-400` |

---

## 6. 리딩 UI (ReadingOverlay)

### 6.1 위치: 하단 고정 오버레이

- z-30 백드롭 (bg-slate-950/40) + z-40 패널
- max-w-2xl mx-auto, bg-slate-900/95 backdrop-blur
- GameHUD(sticky top)와 공존, PhaseTransition(z-50)보다 아래

### 6.2 구성

```
ReadingOverlay
├── ReadingBackdrop (fixed inset-0 z-30, 반투명)
├── ReadingPanel (fixed bottom-0 z-40)
│   ├── SpeakerLine (캐릭터 이름 + 색상 도트)
│   ├── DialogueText (TypewriterEffect — 40ms/글자)
│   └── ReadingControls (advanceMode별)
```

### 6.3 advanceMode별 컨트롤

| 모드 | UI | 동작 |
|------|-----|------|
| gm | 방장만 "다음" 버튼 (amber-600), 플레이어는 "대기 중..." | 서버 reading:advance |
| auto | 타이머 바 표시, 버튼 없음 | voice 완료 + delay → 자동 |
| player | 모든 플레이어 "다음" 버튼 + 진행 현황 | 각자 로컬 진행 |

- 타이핑 클릭 = 즉시 완료, 완료 후 클릭 = 다음
- `prefers-reduced-motion` → 타이핑 스킵, 즉시 표시

### 6.4 SoundControl 확장 (2 → 4채널)

기존 VolumeSlider 재사용:
| 채널 | 아이콘 | 기본값 |
|------|--------|--------|
| 마스터 | Volume2 | 80% |
| BGM | Music | 60% |
| 음성 | Mic | 100% |
| 효과음 | Headphones | 70% |

---

## 7. 파일 구조

### 백엔드 (새로 생성)
```
apps/server/
├── db/migrations/00015_theme_media.sql
├── db/queries/media.sql
├── internal/
│   ├── infra/storage/
│   │   ├── provider.go
│   │   └── r2.go
│   └── module/media/
│       ├── audio.go
│       └── audio_test.go
```

### 백엔드 (수정)
```
├── internal/
│   ├── domain/editor/
│   │   ├── handler.go      (+6 미디어 핸들러)
│   │   ├── service.go      (+Service 인터페이스 확장, 미디어 구현)
│   │   └── types.go        (+MediaResponse, 요청 타입들)
│   ├── engine/
│   │   ├── types.go        (+ActionStopAudio, PhaseConfig.bgmId, GameConfig.mediaAssets)
│   │   ├── engine.go       (+enterCurrentPhase bgmId 자동 주입)
│   │   └── validation.go   (+미디어 참조 검증)
│   ├── module/
│   │   ├── progression/reading.go  (+Lines/BGMId, voiceId 발행, voice_ended)
│   │   └── register.go     (+media blank import)
│   └── apperror/codes.go   (+MEDIA_* 에러 코드 7개)
```

### 프론트엔드 (새로 생성)
```
apps/web/src/features/audio/
├── AudioOrchestrator.ts
├── layers/
│   ├── BgmManager.ts
│   ├── VoiceManager.ts
│   └── YouTubePlayer.ts
├── hooks/
│   ├── useAudioEvents.ts
│   └── useTypingEffect.ts
└── components/
    ├── ReadingOverlay.tsx
    ├── ReadingLine.tsx
    └── ReadingControls.tsx

apps/web/src/features/editor/components/
├── MediaTab.tsx
├── MediaToolbar.tsx
├── MediaCard.tsx
├── MediaDetail.tsx
├── MediaUploadPane.tsx
└── WaveformPlayer.tsx

apps/web/src/shared/components/
└── MediaPicker.tsx
```

### 프론트엔드 (수정)
```
├── features/audio/
│   ├── AudioManager.ts      (+getGainNode)
│   ├── AudioProvider.tsx     (→ Orchestrator 생성, WS 확장)
│   ├── types.ts             (+MediaPlayPayload, BgmSetPayload 등)
│   ├── index.ts             (+새 export)
│   └── components/SoundControl.tsx  (+4채널)
├── features/editor/components/
│   └── constants.ts         (+media, endings 탭)
├── stores/audioStore.ts     (+voiceVolume, reading 상태)
└── packages/shared/src/ws/types.ts  (+audio/reading 이벤트)
```

---

## 8. 구현 순서 (권장)

### Step 1: DB + Storage (백엔드 기반)
1. Migration 00015 + sqlc 쿼리
2. storage.Provider 인터페이스 + R2 구현
3. MediaService + 핸들러 (CRUD + Presigned URL)
4. YouTube oEmbed + URL 검증
5. 파일 검증 (magic bytes) + 리소스 제한
6. 테스트

### Step 2: 게임 엔진 확장
7. ActionStopAudio + AudioModule (PhaseReactor)
8. PhaseConfig.bgmId + enterCurrentPhase 자동 주입
9. ReadingModule 확장 (voiceId, voice_ended, BGMId)
10. configJson 스키마 + validation 확장
11. 테스트

### Step 3: 프론트엔드 오디오
12. BgmManager (크로스페이드 + HTMLAudioElement)
13. VoiceManager (순차 재생 + ducking)
14. YouTubePlayer 래퍼
15. AudioOrchestrator (합성 facade)
16. audioStore 확장 + useAudioEvents 훅
17. SoundControl 4채널
18. iOS/모바일 호환성

### Step 4: 에디터 미디어 탭
19. MediaTab (목록 + 상세 + 업로드 + YouTube)
20. MediaPicker (공용 모달)
21. EDITOR_TABS 확장 (5→7, EndingsTab은 Phase 7.8)

### Step 5: 리딩 UI
22. ReadingOverlay + TypewriterEffect
23. ReadingControls (advanceMode 3종)
24. WS 연동 (reading:start/advance/end + voice_ended)

### Step 6: 통합 테스트
25. Go 테스트 (서비스 + 모듈 + 핸들러)
26. FE 테스트 (Vitest + MSW)
27. E2E 시나리오 (업로드 → 에디터 → 게임 재생)

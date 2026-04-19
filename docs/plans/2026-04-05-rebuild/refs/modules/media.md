# Media 모듈 (1개) — 오디오 브리지

> Phase 11~12(2026-04-13) 메타포 + 라운드 음성 피드백 도입 시 독립 카테고리로 분리.
> 스펙 `PhaseAction 12종` 테이블에서 "모듈 무관"으로 분류됐던 `PLAY_SOUND / PLAY_MEDIA / SET_BGM` 등 오디오 계열 액션을 **WebSocket 브로드캐스트 가능한 이벤트로 변환**할 전담 PhaseReactor가 필요해서 승격.

---

## 33. AudioModule

```
타입: audio | 카테고리: MEDIA | 인증: SESSION
PhaseReactor: ReactsTo [PLAY_SOUND, PLAY_MEDIA, SET_BGM, STOP_AUDIO]
인터페이스: Module + PublicStateModule + PhaseReactor + PhaseHookModule + GameEventHandler
ConfigSchema: 없음 (PhaseAction + EventBus 전구동)
State 공개성: public (PublicStateMarker 임베드 — 전원 동일한 사운드스케이프)
```

**State Shape:**
```json
{ "currentBGMId": "...", "phaseBGMId": "..." }
```
- `currentBGMId` — 현재 재생 중 BGM
- `phaseBGMId` — 페이즈 진입 시 `SET_BGM`으로 고정된 BGM (reading 중 override되어도 복원 기준점)

---

## PhaseAction → EventBus 매핑

| PhaseAction | 발행 이벤트 | 비고 |
|-------------|----------|------|
| `PLAY_SOUND` | `audio.play_sound` | 일회성 SFX |
| `PLAY_MEDIA` | `audio.play_media` | 비디오/장시간 오디오 |
| `SET_BGM` | `audio.set_bgm` | `currentBGMId` + `phaseBGMId` 동시 갱신 |
| `STOP_AUDIO` | `audio.stop` | 전체 정지 |

`ReactTo`는 `action.Params`(JSON)를 그대로 event payload로 전달. 클라이언트 계약은 WS layer에서 확정.

---

## Reading 모듈 이벤트 브리지

`Init`에서 EventBus 두 개 구독:

```
reading.line_changed → (voiceId 존재 시) audio.play_voice { voiceId }
reading.completed    → (phaseBGMId 존재 시) audio.set_bgm { mediaId: phaseBGMId, fadeMs: 1500 }
```

**의도:**
- 대사 라인별 자동 음성 재생 (voiceId는 ReadingModule의 `configJson.phases[].readingSection.lines[].voiceId`)
- 리딩 중 SET_BGM으로 BGM이 일시 override되어도 `reading.completed` 시 페이즈 BGM 자동 복원
- `SET_BGM` 액션 수신 시 `currentBGMId`와 `phaseBGMId`를 동시 갱신 → reading override는 EventBus `audio.set_bgm`을 **직접** 발행해야 phaseBGMId가 안 바뀜 (이중 경로 분리)

---

## GameEventHandler

`Validate` — `audio:play / pause / resume / stop` 이벤트 타입 허용
`Apply` — `BuildState()` 결과를 `state.Modules["audio"]`에 스냅샷

이벤트 소싱 모드에서 AudioModule 상태를 `GameState.Modules["audio"]`에 실어 보낼 수 있게 함.

---

## 왜 PublicStateMarker (opt-out) 인가

- BGM/SFX는 **플레이 경험의 공통 무대 장치** — 모든 플레이어가 동시에 같은 소리를 들어야 함
- per-player redaction은 의미 없음 (개인 voice 라인도 `voiceId`만 브로드캐스트, 실제 재생 권한은 클라이언트 로직이 판단)
- F-sec-2 게이트 통과 방식: `engine.PublicStateMarker` 임베드

```go
type AudioModule struct {
    engine.PublicStateMarker
    // ...
}
var _ engine.PublicStateModule = (*AudioModule)(nil)
```

---

## 호환성 / 의존

- **independent** — conflict 없음
- **선택 연계**: `Reading` — line_changed / completed 이벤트 구독 시 자동 음성·BGM 전환
- **클라이언트**: WS layer에서 `audio.*` 이벤트를 받아 `<audio>` / `<video>` 엘리먼트 제어 (실 재생은 프런트 책임)

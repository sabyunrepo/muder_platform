# Phase 7.7 오디오/미디어 — 결정 근거 (Context)

> 6전문가 토론에서 도출된 주요 설계 결정과 그 근거를 기록한다.

---

## D1. 업로드 방식: Presigned URL vs 서버 프록시

**결정**: Presigned URL 2-step

| 항목 | Presigned URL | 서버 프록시 |
|------|--------------|------------|
| 서버 부하 | 낮음 (메타만) | 20MB 스트리밍 |
| P95 영향 | 없음 | 악화 확실 |
| CORS | R2 버킷 설정 필요 | 불필요 |
| 파일 검증 | 사후 (confirm) | 실시간 |

**근거**: 설계 문서(`refs/security-testing-i18n.md:41`)에서 이미 Presigned URL로 결정됨. 20MB 오디오 파일이 서버를 경유하면 다른 요청에 영향. infra-security 전문가 권장.

**Trade-off**: 2-step이라 구현 복잡도 ↑, 사후 검증이라 악성 파일 임시 저장 최대 30분. orphan 정리 asynq 작업으로 해결.

---

## D2. 버킷 접근: Private + Signed URL vs Public

**결정**: Private + Signed Download URL (15분 TTL)

**근거**: 유료 테마의 오디오 에셋은 콘텐츠 자산. Public URL 유출 시 무제한 접근 → 유료 모델 붕괴. CDN 캐싱은 Cloudflare Cache-Tag로 관리.

**Trade-off**: CDN 캐시 미스 가능성 ↑. 그러나 게임 세션 내 동일 미디어는 브라우저 캐시로 충분.

---

## D3. 미디어 제한: 100개/테마 vs 200개/테마

**결정**: 100개/테마, 500MB/테마, 2GB/유저

**근거**: BGM 10개 + SFX 50개 + VOICE 40개 = 100개면 복잡한 테마도 충분. 보수적으로 시작하고 요청 시 상향. infra-security 전문가의 비용 통제 권장.

---

## D4. AudioManager 아키텍처: Orchestrator vs 단일 클래스 확장

**결정**: AudioOrchestrator facade + 3 독립 레이어

**근거**: 기존 SFX AudioManager (205줄)를 최소 변경하면서 BGM/Voice 추가. 레이어별 독립 테스트 가능, 관심사 분리. frontend-architect 권장.

**Trade-off**: 간접 계층 1개 + 파일 수 증가. 그러나 단일 클래스에 3레이어를 넣으면 500줄+ 되어 유지보수 저하.

---

## D5. BGM 재생: HTMLAudioElement vs AudioBufferSourceNode

**결정**: BGM은 HTMLAudioElement + createMediaElementSource()

**근거** (audio-engineer):
- 20MB mp3를 AudioBuffer로 디코딩하면 ~200MB PCM 메모리 소모
- HTMLAudioElement는 스트리밍으로 수 MB만 버퍼
- seek 가능, 루프 네이티브 지원
- createMediaElementSource()로 Web Audio GainNode 체인 연결 가능

**제약**: element당 한 번만 source 생성 가능 → 초기화 시 생성하고 재사용.

---

## D6. Howler.js 사용 여부

**결정**: 미사용 (순수 Web Audio API)

**근거** (audio-engineer): 설계 문서에 Howler 언급 있으나 현재 코드는 이미 순수 Web Audio API. 의존성 감소, 번들 절약, 크로스페이드/ducking 정밀 제어에 Web Audio API 직접 사용이 유리.

---

## D7. YouTube 크로스페이드

**결정**: setInterval 기반 소프트웨어 페이드

**근거**: YouTube IFrame은 cross-origin 제약으로 Web Audio 그래프에 진입 불가. linearRampToValueAtTime 사용 불가능. 50ms 간격 setInterval은 2초 BGM 페이드에 체감 차이 없음.

**Trade-off**: FILE→YouTube 전환 시 미세한 UX 차이 가능. 대부분 사용자가 인지하지 못하는 수준.

---

## D8. Voice 레이어: 서버 vs 클라이언트 책임 분리

**결정**: 서버는 "무엇을 재생하라" 지시만, 실제 오디오 100% 클라이언트

**근거** (game-engine-expert):
- 서버가 오디오 타이밍을 관리하면 네트워크 지연이 UX에 직접 영향
- advanceMode=auto에서 voice 완료 감지는 클라이언트만 가능 (onended 이벤트)
- 클라이언트가 `reading:voice_ended` WS 메시지로 서버에 보고

**Trade-off**: 악의적 클라이언트가 즉시 voice_ended 전송 가능 (치팅 표면). 그러나 리딩은 경쟁 요소가 아니므로 치팅 인센티브 없음.

---

## D9. PhaseAction 오디오: module-independent vs AudioModule 전용

**결정**: module-independent + AudioModule PhaseReactor 병행

**근거** (game-engine-expert):
- PLAY_MEDIA, SET_BGM은 dispatcher의 broadcastAction으로 전파 (기존 패턴)
- AudioModule이 SupportedActions에서 선언하여 자동 수신
- AudioModule 비활성이어도 액션 에러 안 남 (오디오는 선택적)
- ActionRequiresModule에 등록하면 오디오 없는 테마에서 에러 발생

---

## D10. 리딩 UI 위치: 하단 고정 vs 중앙 모달

**결정**: 하단 고정 오버레이

**근거** (ux-designer):
- 비주얼 노벨 장르 관례 (하단 대사 박스)
- 상단 GameHUD + 중앙 게임 패널과 공존 가능
- z-30/40으로 PhaseTransition(z-50)보다 아래

---

## D11. bgmId 자동 주입 vs onEnter 수동

**결정**: 자동 주입 + 수동 호환

**근거** (game-engine-expert):
- PhaseConfig.bgmId로 90% 유스케이스를 1줄로 해결
- enterCurrentPhase()에서 onEnter 앞에 SET_BGM 자동 dispatch
- onEnter에 수동 SET_BGM도 여전히 가능 (자동 주입 후 수동으로 오버라이드)
- DX 우수, 테마 작성자 실수 감소

**Trade-off**: engine.go에 오디오 인지 로직 침투 (약한 SRP 위반). 그러나 1줄 조건문이라 허용 가능.

---

## D12. YouTube duration 조회

**결정**: 클라이언트에서 IFrame API로 감지 후 PATCH 보고

**근거** (backend-architect):
- YouTube oEmbed API는 duration 미제공
- YouTube Data API v3는 API key + quota 필요
- duration은 선택적 메타데이터 (UI 표시용)
- 클라이언트 IFrame에서 `player.getDuration()` 호출 후 서버에 PATCH

---

## D13. configJson 내 MediaAssets vs DB 참조만

**결정**: GameConfig.mediaAssets 배열 포함 (유효성 검증용)

**근거** (game-engine-expert):
- validation.go에서 bgmId/mediaId 참조 유효성 검증 필요
- 게임 시작 시 필요한 미디어 URL을 configJson에서 바로 조회
- theme publish 시 DB의 theme_media → configJson.mediaAssets 자동 동기화

**Trade-off**: configJson 크기 증가. 그러나 미디어 100개 × URL 정보 = 수 KB 수준.

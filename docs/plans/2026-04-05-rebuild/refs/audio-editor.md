# 오디오/미디어 + 게임 에디터 상세

## 미디어 라이브러리

**DB**: theme_media (id, theme_id, name, type[BGM/SFX/VOICE], source_type[FILE/YOUTUBE], url, storage_key, duration, tags)
- FILE: R2 업로드 (mp3/ogg/wav, 20MB)
- YOUTUBE: URL만 저장, oEmbed API 메타 조회
- API: `/api/editor/themes/:id/media` (CRUD)

## 리딩 섹션 (대사/나레이션)

```json
// configJson.phases[].readingSection (옵셔널)
{
  "advanceMode": "gm|auto|player",
  "bgmId": "media-uuid",
  "lines": [{ "id", "speaker", "text", "voiceId", "autoAdvance", "delay" }]
}
```
- gm: 방장 "다음" → 전체 표시+음성. auto: 음성 끝나면 자동. player: 각자 페이스
- ReadingModule 서버 모듈, Redis `reading:{sessionId}:lineIndex`

## BGM
- 페이즈별: phases[].bgmId. 리딩 오버라이드: readingSection.bgmId
- 크로스페이드 2초, 루프 재생

## AudioManager (클라이언트)
```
3레이어: BGM(60%) / Voice(100%) / SFX(70%) / Master(80%)
FILE → Howler.js | YOUTUBE → YouTube IFrame API
크로스페이드, 모바일 autoplay 대응 (AudioContext.resume)
볼륨 localStorage 유지
```

## PhaseAction 확장
PLAY_MEDIA(mediaId), SET_BGM, STOP_AUDIO (기존 PLAY_SOUND 레거시 유지)

---

## 에디터 탭 구조

### 고정 탭 (7개)
1. 개요 — 기본 정보 + 통계
2. 시나리오 — 프롤로그/오프닝/역할지/엔딩 + 구조화 대사
3. 캐릭터 — CRUD + 관계도
4. 모듈 — 선택/설정 (ConfigSchema 자동 렌더링)
5. 게임 흐름 — ReactFlow 페이즈 + 시뮬레이션 + BGM 매핑
6. **미디어** — 미디어 라이브러리 (업로드/YouTube/미리듣기)
7. **엔딩** — 분기 에디터 (IF-THEN 조건, 콘텐츠 라이브러리 선택)

### 동적 탭 (모듈 의존, 4개)
장소/단서, 라운드 단서, 단서 관계 그래프, 자동 GM

## 콘텐츠 시스템
- **고정형** 🔒: 모듈/캐릭터 추가 시 자동 (공지, 프롤로그, 롤지, 안내문)
- **자율형** ✏️: 제작자 임의 생성 (엔딩, 리딩 대사, 커스텀)
- 콘텐츠 라이브러리: 드롭다운 + 인라인 미리보기로 선택

## 에디터 UX
- 실시간 미리보기 (BGM 재생, 대사 시뮬레이터)
- 버전 관리 (theme_versions, diff, 되돌리기)
- 교차 검증 (modules↔phases, 순환 의존, 미사용 에셋)
- MediaPicker 공용 컴포넌트

## 에디터 API
- 미디어: GET/POST/PATCH/DELETE `/themes/:id/media`
- 버전: GET `/themes/:id/versions`, POST `.../restore`
- 엔딩: GET/POST/PATCH/DELETE `/themes/:id/endings`
- 검증: POST `/themes/:id/validate/deep`

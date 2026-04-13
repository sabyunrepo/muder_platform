# Scope & 7 Standard Decisions

## 1. Scope

### IN
- ClueInteraction 모듈에 아이템 사용(use) 플로우 추가
- DB: clues 테이블에 is_usable, use_effect, use_target, use_consumed 컬럼
- 에디터: ClueForm에 아이템 설정 UI
- 게임 UI: 아이템 사용 버튼 + 대상 선택 + 결과 표시
- 메타포 6인 JSON 템플릿 (go:embed)
- 메타포 테마 시드 데이터 (6 캐릭터, 장소별 단서, 히든 미션)
- E2E 테스트: 전체 게임 플로우

### OUT
- 새 모듈 생성 (기존 33개 활용)
- LiveKit 음성 통합 테스트
- 모바일 테스트
- 다른 장르 템플릿 수정
- 아이템 효과 중 steal/reveal/block/swap (설계만, 구현은 peek만)

## 2. Architecture — ClueInteraction 확장

기존 ClueInteraction 모듈의 HandleMessage에 아이템 사용 플로우 추가:

### DB 확장 (clues 테이블)
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| is_usable | BOOLEAN | false | 사용 가능 여부 |
| use_effect | TEXT | NULL | peek/steal/reveal/block/swap |
| use_target | TEXT | NULL | player/clue/self |
| use_consumed | BOOLEAN | true | 사용 후 소멸 |

### WS 프로토콜
```
→ clue:use { clueId }
← clue:item_declared { userId, clueName }       // broadcast
← clue:use_prompt { effect, targetType }         // to user

→ clue:use_target { targetPlayerId }
← clue:use_result { clueDetail }                 // to user only
← clue:item_resolved { userId }                  // broadcast, mutex release
```

### 뮤텍스
- 모듈 내부 `activeItemUse *ItemUseState` 필드
- nil이면 사용 가능, non-nil이면 다른 사용자 차단
- 타임아웃: 30초 미응답 시 자동 해제

## 3. Lifecycle
- 아이템 상태: 세션 메모리 (Redis 불필요 — SerializableModule로 스냅샷)
- 사용 완료된 아이템: use_consumed=true면 플레이어 보유 목록에서 제거
- 페이즈 전환 시 진행 중인 아이템 사용 자동 취소

## 4. External Interface
- REST: 기존 에디터 API (clue CRUD) — is_usable 등 필드 추가
- WS: clue:use, clue:use_target (신규), 기존 네임스페이스 확장
- 템플릿: presets/murder_mystery/metaphor_6p.json (신규)

## 5. Persistence
- 아이템 필드: clues 테이블 (sqlc 재생성)
- 게임 중 상태: ClueInteraction.SaveState()에 usedItems 포함
- 테마 데이터: 기존 themes + theme_characters + theme_clues 테이블

## 6. Operational Safety
- 아이템 사용 뮤텍스 타임아웃 (30초) — deadlock 방지
- peek 결과는 사용자에게만 전송 (다른 플레이어에게 누출 안 됨)
- 존재하지 않는 clueId/targetPlayerId → 400 에러
- E2E 테스트로 전체 흐름 검증

## 7. Rollout
- Feature flag 없음 — is_usable=false가 기본값이므로 기존 테마에 영향 없음
- 마이그레이션: ALTER TABLE ADD COLUMN (기본값 있어 안전)
- Wave 순차 실행 (DAG 의존성 준수)

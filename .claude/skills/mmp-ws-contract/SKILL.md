---
name: mmp-ws-contract
description: MMP v3 WebSocket 3자 스키마 대조 체크리스트. 백엔드 envelope registry(apps/server/internal/ws/envelope_catalog.go 등) ↔ 프론트엔드 MSW 핸들러(apps/web/src/mocks/handlers/**) ↔ 프론트엔드 메시지 리듀서(apps/web/src/services/gameMessageHandlers.ts 등) 3자 드리프트 점검. 낙관적 업데이트 롤백 포인트, 재접속 스냅샷 재개 일관성, 이벤트 이름·payload 필드 누락·오타 탐지. WS envelope 추가·수정, 재접속 복구, 낙관적 업데이트 관련 변경 시 필수.
---

# mmp-ws-contract — WebSocket 3자 스키마 대조

## 왜
WS envelope은 **3곳**에 정의가 분산된다:
1. **백엔드**: envelope_catalog(등록) + handler(처리)
2. **프론트엔드 MSW**: 테스트용 mock 핸들러
3. **프론트엔드 리듀서**: 실제 메시지 수신 분기

셋이 일치해야 real-backend/stubbed 양쪽에서 동일 플로우가 성립한다. 이 중 하나라도 drift하면:
- E2E는 통과하는데 prod에서 메시지 드롭
- 낙관적 업데이트가 서버 확인 이벤트를 받지 못해 영구 pending
- 재접속 시 스냅샷 payload 구조 불일치로 silent data loss

Phase 17.5·18.0·18.1·18.6에서 반복적으로 발견된 회귀 패턴.

## 3자 대조 체크리스트

### 1. 이벤트 이름 · 타입 정의
- [ ] 백엔드 envelope_catalog에 등록된 이벤트 목록 추출
- [ ] 프론트엔드 MSW 핸들러가 처리하는 이벤트 목록 추출
- [ ] gameMessageHandlers / roomMessageHandlers가 dispatch하는 이벤트 목록 추출
- [ ] 3자 교집합·차집합 매트릭스 생성 — **차집합 = drift**

### 2. Payload 필드 대조
각 이벤트별로:
- [ ] 백엔드 struct 필드 (Go)
- [ ] MSW mock payload (TypeScript)
- [ ] 리듀서 수신 타입 (TypeScript)
- [ ] 필드 이름 camelCase ↔ snake_case 일관성 (serialization tag)
- [ ] optional/required 일치

### 3. 낙관적 업데이트 롤백 포인트
- [ ] 낙관적으로 업데이트하는 store action 식별
- [ ] 서버 확인 이벤트(success)와 거부 이벤트(error) 모두 존재
- [ ] error 수신 시 rollback 핸들러 연결
- [ ] timeout 처리 (서버가 응답 없을 때)

### 4. 재접속 스냅샷 재개
- [ ] `resume` / `snapshot` 이벤트 payload 구조
- [ ] 클라이언트가 수신 시 Zustand Domain layer에 반영하는 로직
- [ ] 재접속 전·후 UI 상태 diff가 없어야 함
- [ ] Redaction 필드(token, 개인정보)가 스냅샷에 포함되지 않는지 security-reviewer와 crosscheck

### 5. 순서 보장
- [ ] 이벤트 순서가 의미 있는 경우(turn 진행, phase 전이) sequence 번호 or timestamp
- [ ] 클라이언트가 out-of-order를 감지·처리

## 감사 방법 (정적)
```bash
# 백엔드 이벤트 목록 추출 (예시 경로)
grep -rn "EventType\|envelope.Register\|EnvelopeCatalog" apps/server/internal/ws/ apps/server/internal/module/

# MSW 핸들러 이벤트 추출
grep -rn "event:\|type:" apps/web/src/mocks/handlers/

# 리듀서 분기 추출
grep -rn "case '" apps/web/src/services/*MessageHandlers.ts
```

3자 목록을 diff → drift 매트릭스.

## 출력 포맷 (감사 draft 섹션)
```
## WS Contract Drift
| Event | Backend | MSW | Reducer | Drift |
|-------|---------|-----|---------|-------|
| clue:reveal | ✓ | ✓ | ✓ | — |
| clue:hide   | ✓ | ✗ | ✓ | MSW 누락 |

## Rollback Gaps
- action X: 서버 error 이벤트 핸들러 없음 (file:line)

## Resume Gaps
- snapshot payload에 field Y 누락 (file:line)
```

## 소유자
- go-backend-engineer와 react-frontend-engineer **공동** 산출.
- 단독 draft는 `09-ws-contract.md`에 둔다.

## 체크리스트
- [ ] 3자 이벤트 교집합·차집합 매트릭스
- [ ] 각 이벤트 payload 필드 대조
- [ ] 낙관적 업데이트 rollback·timeout 존재
- [ ] snapshot/resume payload 대조
- [ ] 순서 보장 필요 이벤트 식별
- [ ] security-reviewer에게 snapshot redaction cross-check 요청

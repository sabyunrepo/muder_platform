# MMP v3 클린 리빌드 — 결정 근거

> 각 기술 선택의 why와 트레이드오프.

## 1. 왜 Go (백엔드)
- Gateway가 이미 Go. goroutine 동시성, 100K WS, 15MB 바이너리
- Rust 대비: 28개 모듈 이식에 lifetime이 개발 속도 저하, 이 규모에서 성능 차이 무의미
- 트레이드오프: TS 타입 공유 손실 → OpenAPI + JSON Schema로 대체

## 2. 왜 네이티브 WebSocket (Socket.IO 폐기)
- Go에서 Socket.IO 서버 미성숙. 프로토콜 오버헤드 제거.
- Room/reconnection 직접 구현 필요 (~500줄 추가)

## 3. 왜 sqlc (Prisma 대체)
- SQL→타입 생성, any 남용 해결, 제로 런타임 오버헤드
- 트레이드오프: SQL 직접 작성, 마이그레이션 별도 도구(goose)

## 4. 왜 React+Vite (Next.js 제거)
- 17개 페이지 전부 CSR, SSR 0개. K8s web pods 제거, CDN 정적 배포
- SEO 3-4페이지 → Go html/template로 처리

## 5. 왜 동적 스크립트 러너 (고정 FSM 불채택)
- phases가 자유 문자열, 테마마다 다른 흐름, 같은 상태 반복 가능
- 3가지 Strategy(Script/Hybrid/Event)가 단일 FSM으로 불가

## 6. 왜 모듈 = 설정 단일 소스
- initialSettings 글로벌 → 불일관. 모든 설정을 해당 모듈 ConfigSchema로.
- 에디터 자동 렌더링, 발견성 향상

## 7. 왜 콘텐츠 고정형 + 자율형
- 캐릭터 추가 → 롤지 자동 생성 (누락 방지)
- 엔딩은 분기 다양 → 자율형 (드롭다운+미리보기)

## 8. 왜 Voting 통합 (SecretBallot 흡수)
- 공개/비밀이 동일 로직 (cast→count→tieBreaker), mode 설정만 다름
- 모듈 수 감소, conflicts 불필요, 중복 제거

## 9. 왜 밀담 사전 생성 방식
- 에디터에서 밀담 장소 설계 → 게임 세계관에 자연스러움
- PhaseAction(OPEN/CLOSE_GROUP_CHAT)으로 유연한 페이즈 제어

## 10. 디자인 패턴 선택
- Handler→Service→Repository/Provider: 테스트 용이, 교체 용이
- Thin Repository: sqlc 타입 안전 + 도메인 인터페이스
- Event-Driven(동기+비동기): 도메인 간 결합도 제거
- DM+그룹 통합: 코드 중복 50% 감소
- 수익 70:30: 업계 표준 (앱스토어 30%)

## 11. 미결정 사항
| 항목 | 후보 | 결정 시점 |
|------|------|----------|
| HTTP 라우터 | Chi vs Echo | Phase 1 |
| WS 라이브러리 | gorilla vs nhooyr | Phase 1 |
| Event Sourcing | 간소화 vs 풀 | Phase 3+ |
| Redis → Valkey | Redis 7 vs Valkey | 프로덕션 전 |
| 수익 배분 시점 | 즉시 vs 정산 시 | Phase 7.6 |
| 통계 차트 | Recharts vs Chart.js | Phase 7.6 |

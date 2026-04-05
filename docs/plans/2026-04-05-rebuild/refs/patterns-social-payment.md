# 디자인 패턴 + 소셜 + 결제/수익

## 디자인 패턴

### 계층: Handler → Service → Repository/Provider
- Service가 인터페이스 정의, Repository/Provider가 구현
- 모든 계층 인터페이스 기반 → mock 테스트 용이

### 7개 Provider (외부 서비스 갈아끼우기)
voice.Provider(LiveKit), payment.Provider(Toss/Stripe), storage.Provider(R2),
auth.OAuthProvider(Discord/Google), notification.Provider, push.Provider(FCM), cache.Provider(Redis)

### Event-Driven
- 동기 EventBus: 트랜잭션 내 즉시 (결제→코인)
- 비동기 EventBus (Redis Streams): 재시도 필요 (알림, 통계)

### Middleware Chain
```
base = Chain(Recovery, RequestID, Logging, CORS)
authed = base.Append(Auth, RateLimit)
admin = authed.Append(RequireRole("ADMIN"))
```

### Module Plugin
init() + blank import 컴파일 타임 등록. ConfigSchema 선언적. build tag 선택적 포함.

---

## 소셜 시스템 (카카오톡 스타일)

### 친구: friendships(PENDING/ACCEPTED), user_blocks, Redis 온라인 상태
### 1:1 DM + 그룹 채팅: chat_rooms(DM|GROUP), chat_room_members(lastReadAt), chat_messages
### 읽음 확인: 안 읽은 수 = 참여자 - 읽은 사람 (lastReadAt 기반)
### 게임 연동: GAME_INVITE / GAME_RESULT 메시지 타입
### WS 분리: /ws/social (userId 인증, 영구 연결)
### UI: slate-900 배경, amber 배지, 메시지 버블 (우측 amber/좌측 slate)

---

## 결제 + 테마 제작자 수익/통계

### PaymentProvider
CreatePayment, ConfirmPayment, RefundPayment, HandleWebhook
상태 기계: PENDING → CONFIRMED → SETTLED / REFUNDED / FAILED
멱등성: IdempotencyGuard (DB unique key)

### 코인: coin_transactions, SELECT FOR UPDATE 동시성 제어
### 수익: 70% 제작자, 30% 플랫폼 (configurable)
- creator_earnings (건별), settlements (월별 정산)
- 정산: cron → CALCULATED → APPROVED → PAID_OUT
- 세금: 개인 3.3%, 사업자 10%

### 통계: theme_daily_stats (배치 집계), Redis 캐시
- /creator/dashboard, /creator/themes/:id/stats, /creator/earnings

### Admin: settlements 승인, revenue 요약, fee-rate 변경

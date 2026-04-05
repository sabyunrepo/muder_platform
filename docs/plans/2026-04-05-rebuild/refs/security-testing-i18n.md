# 보안 + 테스트 + i18n + 데이터이관 + 에셋 + Admin + 모바일

## 보안
- **JWT**: Access 15분(HS256) + Refresh 30일(rotation + family attack 방어)
- **OAuth**: Discord, Google + 카카오 확장 (Provider 인터페이스, PKCE S256)
- **RBAC**: PLAYER→GM→CREATOR→ADMIN + Resource-based (자기 테마만 수정)
- **Rate Limit**: Redis sliding window + 인메모리 폴백 (API 100/min, Auth 20/15min)
- **계정 잠금**: 5회 실패 → 15분 lockout
- **입력 검증**: go-playground/validator, sqlc 파라미터화 (SQL injection 방지)
- **Circuit Breaker**: gobreaker (PG, LiveKit, 외부 API, 5회 연속 실패→Open)
- **API 버전**: /api/v1/ (URL path), Sunset 헤더 + 3개월 deprecation

## 성능 SLA
| 지표 | 목표 |
|------|------|
| REST P50/P95/P99 | <30ms / <100ms / <500ms |
| WS 채팅 P95 | <50ms |
| 인스턴스당 WS | 5,000 |
| 전체 (HPA) | 50,000 |
| SPA FCP/LCP | <1.5s / <2.5s |

## 테스트 전략
- **Go**: mockgen + testcontainers-go (실제 PG+Redis), 75%+ 커버리지
- **React**: Vitest + Testing Library + MSW + Playwright E2E
- **모듈**: 테이블 드리븐 시나리오 + testdata JSON, 85%+
- **CI**: 단위(병렬) → 통합(PG+Redis) → E2E(Docker Compose)

## i18n
- **원칙**: 에러 코드 기반, 클라이언트 번역
- 서버 → `{ code, params }` → 클라이언트 `t('errors.CODE', params)`
- 지원: ko(기본) → en(1차) → ja(2차)
- 게임 콘텐츠: configJson 다국어 키 `{ ko: "고동", en: "Godong" }`
- 서버 i18n: 이메일/푸시 템플릿만 (Go embed)

## 데이터 이관
- 대상: User, Theme, CoinTransaction, PaymentOrder, GameHistory, Review
- 방법: Go CLI (cmd/migrate/) Extract → Transform → Load → Validate
- 다운타임: 새벽 2시간 유지보수 윈도우

## 에셋 관리
- Presigned URL → R2 직접 업로드 → CDN (Cloudflare)
- 이미지 최적화: Cloudflare Image Transformations (온디맨드)
- 제한: 테마당 200MB(단서)+50MB(맵), 유저당 2GB

## Admin
- SUPER_ADMIN > ADMIN > MODERATOR
- 대시보드, 유저/테마/방 관리, 결제/정산, 감사 로그
- admin_audit_logs (action, target, details, ip)

## 모바일 (Expo)
- @mmp/ws-client, @mmp/shared, @mmp/game-logic 공유
- 푸시(expo-notifications), 햅틱, 오디오 백그라운드
- OTA 업데이트 + EAS Build

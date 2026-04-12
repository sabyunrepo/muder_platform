# Scope & Decisions

## In
- 5개 QA 발견 이슈 수정 (F1~F5)
- 프론트엔드 위주, 백엔드 API 매핑 1건

## Out
- 에디터 기능 개선
- 어드민 페이지 콘텐츠 구현
- OAuth 연동
- 플레이 시간 백엔드 집계 (별도 phase)

## 설계 결정
1. 기존 코드 패턴 유지 (수정만)
2. ProtectedRoute 개선이 F2+F3 동시 해결
3. RoleRoute 신규 컴포넌트 (admin 가드)
4. feature flag 불필요 (버그픽스)

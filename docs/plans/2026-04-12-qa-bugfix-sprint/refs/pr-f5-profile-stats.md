# PR-F5: 프로필 통계 표시 수정

## 문제
프로필 페이지에서 총 게임, 승률, 플레이 시간, 가입일 모두 "-" 표시

## 원인
1. created_at이 API 응답에 매핑 안 됨 (백엔드)
2. 플레이 시간은 하드코딩 "-" (미구현)
3. total_games=0일 때 "-" 표시 (의도된 동작일 수 있음)

## 수정
1. 백엔드: /v1/profile 응답에 created_at 포함 확인
2. ProfileStats: createdAt 포맷 로직 수정
3. 플레이 시간: "미구현" 또는 숨김 처리

## 파일
- `apps/web/src/features/profile/components/ProfileStats.tsx`
- `apps/server/internal/handler/` (프로필 핸들러)
- `apps/server/internal/service/` (프로필 서비스)

## Tasks
1. T1: 백엔드 /v1/profile API created_at 확인/수정
2. T2: ProfileStats createdAt 포맷 디버깅
3. T3: 플레이 시간 항목 처리

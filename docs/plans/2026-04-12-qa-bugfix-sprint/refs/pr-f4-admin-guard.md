# PR-F4: admin 권한 가드 추가

## 문제
일반 유저가 `/admin` 접근 시 빈 페이지 (권한 체크 없음)

## 수정
1. RoleRoute 컴포넌트 신규 생성 (role 체크)
2. App.tsx에서 /admin을 RoleRoute로 감싸기

## 파일
- `apps/web/src/shared/components/RoleRoute.tsx` (신규)
- `apps/web/src/App.tsx`

## Tasks
1. T1: RoleRoute 컴포넌트 생성 (role prop, 미인가 시 "/" redirect)
2. T2: App.tsx /admin 라우트 가드 적용
3. T3: /creator 라우트도 가드 적용 검토

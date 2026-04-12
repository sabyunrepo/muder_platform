# PR-F1: shop/history CoinTransactions 크래시 수정

## 문제
`apps/web/src/features/payment/components/CoinTransactions.tsx:107`
`data?.data.length` — `data.data`가 undefined일 때 TypeError

## 수정
`data?.data?.length` (optional chaining 추가)

## 파일
- `apps/web/src/features/payment/components/CoinTransactions.tsx`

## Tasks
1. T1: 107번 줄 optional chaining 수정
2. T2: 동일 파일 내 유사 `?.data.` 패턴 검색 및 수정
3. T3: 기존 테스트 실행 확인

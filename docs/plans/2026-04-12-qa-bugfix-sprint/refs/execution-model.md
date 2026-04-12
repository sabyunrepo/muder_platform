# Execution Model — Wave DAG

## 의존성 그래프
```
W1: F1 ──┐
W1: F4 ──┼── W2: F2 ── W3: F3
W1: F5 ──┘
```

## Wave 설명
- **W1**: 독립 3개 PR 병렬 (worktree)
- **W2**: ProtectedRoute는 전체 인증에 영향 → W1 머지 후 단독
- **W3**: F2의 ProtectedRoute 수정에 의존

## 예상 규모
- 전체 ~50줄 변경
- 신규 파일 1개 (RoleRoute.tsx)

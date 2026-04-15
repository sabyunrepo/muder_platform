---
verdict: warn
high_findings: 0
medium_findings: 3
low_findings: 4
blocker: false
---

# Phase 18.4 W0 보안/정확성 리뷰

**범위:** 848f458 + d5e318b — HEAD bbc08f2
**결론:** 머지 블로커 없음. Medium 3건 후속 cleanup.

## Medium
- **M-1**: `/templates*` 라우트가 JWT auth 그룹 밖 — 현재는 go:embed preset만 서빙이라 안전. 주석 + design doc에 public by design 명시 필요.
- **M-2** [중요]: `TemplateHandler`가 `http.Error(w, err.Error(), ...)` 사용 — AppError/RFC 9457 규칙 위반. Sentry/trace/prod detail 마스킹 파이프라인 우회. **후속 PR 필수**.
- **M-3**: `UpdateConfigJson` structured audit log 부재 — config 전체 교체인데 성공 경로 로깅 없음. 포렌식 대비 필수.

## Low
- L-1: template ID 입력 검증 (length cap + charset)
- L-2: `writeJSON` encode 실패 swallow
- L-3: 409 race 공격 분석 — 자기 테마만 접근 가능, 비현실적
- L-4: ReplaceClueRelations 인덱스 에러 문자열 — 민감 정보 없음, 유지 가능

## Pass 체크
- AppError extensions deep-copy 안전
- sqlc 파라미터 바인딩 (SQL injection 방지)
- getOwnedTheme IDOR 가드 양쪽 진입점
- ErrNoRows swallow 좁게 한정, 정보 은닉 이슈 없음
- RFC 9457 Content-Type application/problem+json

## 패턴 경보
`http.Error(w, err.Error(), ...)` 재등장 → `project_coding_rules.md`에 금지 룰 명시 권장.

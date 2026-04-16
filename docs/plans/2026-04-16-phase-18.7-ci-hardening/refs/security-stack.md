# Security Scan Stack — Phase 18.7

보안 스캔 툴 선택 근거와 각 툴의 커버 영역.

## 선택된 스택

| 도구 | 분류 | 커버 영역 | 속도 | SARIF |
|------|------|----------|:----:|:-----:|
| `govulncheck` | SCA (Go) | Go 모듈 CVE + **실제 심볼 호출 여부** 분석 | <30s | ❌ |
| `gitleaks` | Secret scan | 커밋 히스토리 + 현 diff secret 탐지 | <30s | ✅ |
| `trivy` (image) | Container | Docker 이미지 OS/런타임 CVE | 2~3분 | ✅ |
| `osv-scanner` | SCA (dual) | pnpm + Go `go.sum` OSV DB 매칭 | 1~2분 | ✅ |
| `CodeQL` | SAST | JavaScript/TypeScript + Go 정적 분석 | 3~5분 | ✅ |

## 커버리지 매트릭스

| 위협 카테고리 | govulncheck | gitleaks | trivy | osv | CodeQL |
|--------------|:-----------:|:--------:|:-----:|:---:|:------:|
| OSS 취약점 (Go) | ✅ call-graph | — | — | ✅ | — |
| OSS 취약점 (npm) | — | — | — | ✅ | — |
| 컨테이너 OS 패키지 | — | — | ✅ | — | — |
| 평문 secret (커밋) | — | ✅ | — | — | — |
| SQL injection 패턴 | — | — | — | — | ✅ |
| XSS / prototype pollution | — | — | — | — | ✅ |
| Path traversal | — | — | — | — | ✅ |
| 취약 암호화 호출 | — | — | — | — | ✅ |
| 공급망 타이포스쿼팅 | 부분 | — | — | ✅ | — |

## 왜 중복이 필요한가

- `osv` vs `govulncheck`: osv는 lockfile 기반 DB 매칭 (Broad, false positive 높음). govulncheck는 **실제 호출 그래프 분석** (Narrow, false positive 낮음). 두 결과 합쳐야 "영향 있는 CVE"와 "존재만 하는 CVE" 구분 가능.
- `trivy` vs `osv`: trivy는 **이미지 레이어**(apt/apk)까지 스캔, osv는 **애플리케이션 의존성**만. docker base image CVE는 osv로 못 잡음.
- `CodeQL`은 **자체 코드**의 취약점 — 나머지는 모두 **타인 코드**의 취약점. 겹치지 않음.

## 출력 통합

모든 스캐너는 **SARIF** 형식으로 통일 (govulncheck는 `json` → `sarif-converter` 경유):

```
Security tab
├── CodeQL
├── Trivy (container)
├── osv-scanner (lockfile)
├── gitleaks (secrets)
└── govulncheck (Go SCA) — JSON only, PR comment로 대체
```

## 실패 정책

| 툴 | PR blocking | main blocking | severity 기준 |
|----|:-----------:|:-------------:|--------------|
| govulncheck | ✅ | ✅ | HIGH 이상 |
| gitleaks | ✅ | ✅ | 어떤 match든 |
| trivy | HIGH/CRITICAL | HIGH/CRITICAL | — |
| osv | HIGH/CRITICAL | HIGH/CRITICAL | — |
| CodeQL | error-level | error-level | warning은 알림만 |

## False Positive 관리

- `govulncheck`: `go:build` 태그로 제외 영역 분리
- `gitleaks`: `.gitleaks.toml`의 `allowlist` 섹션 (테스트 픽스처용 가짜 토큰 화이트리스트)
- `trivy`: `.trivyignore` 파일 + CVE ID 단위 expire date
- `osv`: `osv-scanner.toml` `ignoredVulns` + reason
- `CodeQL`: `codeql-config.yml` query suite 선택 (default + security-extended 조합)

## 운영 비용

- GitHub Actions 공용 runner 사용 (유료 플랜 불필요)
- `security-fast.yml` 매 PR → 월 예상 CI 시간 <5시간
- `security-deep.yml` main push + nightly → 월 <10시간
- 합계 월 ~15시간 (무료 tier 2000시간 한도 내)

## Renovate와의 연계

PR-7 Renovate 도입 후 보안 스캔이 CVE를 찾으면:
1. osv/trivy가 **취약 버전 식별** → SARIF
2. Renovate이 **같은 package를 자동 감지** → PR 생성
3. 보안 업데이트는 `packageRules.automerge: true`로 즉시 반영

## 향후 확장 (Out of Scope this Phase)

- Semgrep (커스텀 규칙, 예: API 키 리크 패턴)
- Dependency Review Action (PR diff 기준 신규 추가 의존성 경고)
- Scorecard (supply chain posture 평가)
- SLSA Level 3 (provenance만 PR-5에서 커버, 전체 SLSA는 별도)

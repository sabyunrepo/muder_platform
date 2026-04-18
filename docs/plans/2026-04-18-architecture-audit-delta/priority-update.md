# Phase 19 Backlog Priority Update (Delta 반영, 2026-04-18)

> **base:** Phase 19 backlog (`docs/plans/2026-04-17-platform-deep-audit/refs/phase19-backlog.md`)
> **근거:** 본 delta audit (`synthesis.md`)

## TL;DR (핵심 변경)

- **PR-3 (HTTP Error Standardization) 우선순위 상향** → W1 안에서 먼저
- **PR-2, PR-5 scope XL로 확장** → 개별 wave 내 분할 필요
- **PR-4 scope 2파일 추가** (combination.go, editor/service.go, editor/api.ts)
- **PR-6 scope 확장** (editor clue_edge/clue_relation auditlog 편입)
- **신규 Phase 21 후보 4건** (graphify 기반) — 별도 wave 편성 권장
- **Wave 총 순서 유지** (W0 → W1 → W2 → W3). 편성만 변경.

## Wave 편성 (수정안)

### W0 — Foundation (선행, 병렬 불가)
| PR | 변경 | 비고 |
|----|-----|------|
| PR-0 MEMORY Canonical Migration | **S** | 변동 없음 |

### W1 — 긴급 보안/에러 (병렬 3) — **기존 W1 유지 + 순서 변경**
| PR | 변경 | 비고 |
|----|-----|------|
| PR-3 HTTP Error Standardization | **M (우선순위 1위)** | GI-2 증거. F-sec-1 잔존 12건 해소 |
| PR-1 WS Contract SSOT | L | 기존 우선순위 유지 |
| PR-6 Auditlog Expansion | **L+** | **신규 scope:** editor clue_edge/clue_relation handler 포함 (D-SEC-1 흡수) |

### W2 — 모듈/테스트 (순차 권장) — **XL로 확장, 분할 필요**
| PR | 변경 | 비고 |
|----|-----|------|
| PR-2 PlayerAware Mandatory | **XL** | **신규 scope:** D-MO-1 craftedAsClueMap redaction + PR-2a 주 작업 / PR-2b craftedAsClueMap 패치로 분할 권장 |
| PR-5 Coverage Gate + mockgen | **XL** | PR-5a mockgen 재도입 / PR-5b coverage 게이트 / PR-5c editor 회귀 복구(-2.9%p) + fixture 분리(GI-4)로 3분할 권장 |
| PR-7 Zustand Action Unification | M | 변동 없음 |

### W3 — 리팩터/정리 (병렬 2)
| PR | 변경 | 비고 |
|----|-----|------|
| PR-4 File Size Refactor | **L+** | Go 10→**12** (combination.go 533, editor/service.go 505 추가) + TS 3→**4** (editor/api.ts 428) |
| PR-8 Module Cache Isolation | S | 변동 없음 |

### 독립 Hotfix (언제든)
| 항목 | 변경 | 비고 |
|------|-----|------|
| focus-visible 57 | S | 변동 없음 |
| voice token 평문 로그 | S | F-sec-3 여전히 `provider.go:108`. **1시간 fix 권장, W1에 합류 가능** |

### W4 (신설 권장) — graphify 기반 Phase 21 후보
Phase 19 backlog 완료 후 착수. 독립 Phase로 격상해도 무방.

| PR | Size | 심각도 | 근거 |
|----|------|-------|------|
| PR-9 (D-PERF-MUTEX) Mutex Hotspot Audit | M | P1 | GI-1, `unlock`/`Lock` 601 edges |
| PR-10 (D-DEV-RULE) CLAUDE.md ↔ code Linter | S | P1 | GI-8, custom go vet rule |
| PR-11 (D-ARCH-ORPHAN) Admin/Creator Page Dead-code | M | P2 | GI-5, thin community 정리 |
| PR-12 (D-ARCH-MEDIA) Audio/Video Orchestrator 통합 | L | P2 | GI-7, MediaOrchestrator 추출 |

## 예상 기간 재산정

| Wave | Phase 19 추정 | Delta 반영 | 사유 |
|------|---------------|-----------|------|
| W0 | 0.5d | **0.5d** | 변동 없음 |
| W1 | 3-4d | **4-5d** | PR-6 scope 확장 + voice token hotfix 편입 |
| W2 | 4-5d | **6-7d** | PR-2, PR-5 XL → 분할 실행 |
| W3 | 2-3d | **3-4d** | PR-4 2파일 추가 |
| W4 (신설) | — | **4-6d** | graphify 기반 4 PR |
| **합계** | 11-13d | **17-22d** | +6-9d (scope 확장 + W4 추가) |

## 리스크 주의

1. **PR-2 (PlayerAware) + PR-6 (Auditlog)가 겹침** — 둘 다 editor handler·clue 도메인에 손댐. W1·W2 순차로 분리하거나 PR-6 scope에서 editor 부분만 PR-2 완료 후 수행.
2. **PR-5 Coverage Gate 도입은 기존 커버리지 기준 미달 패키지에서 CI 실패 유발** — 초기 gate threshold를 낮게(60%?) 시작해서 점진 상향 권장.
3. **W4 (graphify 기반 후보)는 근거가 INFERRED edge 일부 포함** — 각 PR 진입 전 `graphify explain`/`path`로 재검증 권장.

## 실행 게이트

- **W0 완료 조건:** MEMORY canonical 한 곳 정착, hook 제거 등 선행 정리
- **W1 완료 조건:** F-sec-1 잔존 12건 → 0건, F-sec-4 editor+admin auditlog 커버 100%
- **W2 완료 조건:** F-sec-2 33 모듈 PlayerAware 100%, `domain/editor` 커버리지 ≥19.6% 복구, mockgen 적용 패키지 ≥5개
- **W3 완료 조건:** 500+ Go 12건 → 0건, 400+ TS 4건 → 0건
- **W4 완료 조건:** GI-1/2/5/7/8 각 근거 검증 → action 완료 또는 close (근거 WITHDRAWN)

## 다음 액션

1. 본 audit merge 후 `/plan-start docs/plans/2026-04-17-platform-deep-audit/` 또는 `/plan-new phase-21` 결정
2. W0 PR-0 부터 착수 (가장 Low risk + 선행 필수)
3. 각 Wave 시작 전 `make graphify-refresh` → 최신 graph 기준 재검증 (D 정책)

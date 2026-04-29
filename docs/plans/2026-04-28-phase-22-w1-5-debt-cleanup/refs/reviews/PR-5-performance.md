---
pr: 5
title: "Performance Review — ci.yml runs-on [self-hosted, containerized] 전환"
branch: chore/w1-5-ci-runs-on
base: main
reviewer_focus: performance / efficiency
review_date: 2026-04-29
files_changed: 2
diff: "+4/-4 (ci.yml 4줄 + checklist 2줄)"
---

# PR-5 Performance Review

## Verdict: conditional

조건: MEDIUM-1 carry-over spec 보완 명시 후 머지 허용. HIGH 항목 없음.

---

## HIGH (정량 회귀)

없음.

---

## MEDIUM (정량 trade-off 수용 가능)

### MEDIUM-1 — GHA cache fetch 비용: PR-5 신규 도입이 아님을 명시 필요

bare-host 에서 `go-check` 의 GHA Go module cache (~369MB, Azure blob, 다운로드 ~15~30초) 는 이미 매 run 비용으로 지불되었으나 `Cannot open: File exists` tar 충돌로 효과 0 이었다. containerized (EPHEMERAL=true, 매 job 후 컨테이너 재시작) 전환 시 `~/go/pkg/mod` 디스크 clean → tar 정상 추출 → 약 **+10~20초/run 절감** (기존 효과 없던 cache 가 정상화). `ts-check` 는 bare-host 에서도 tar 충돌 없이 동작 중이었으므로 변화 없음. `docker-build` 는 PR-170 fold-in 으로 `sudo docker build` 직접 실행 — GHA cache 해당 없음.

**신규 비용 없음**. 단, spec §진단 데이터에 "GHA cache 비용 신규 미발생" 명시 미완료 상태로 다음 리뷰어 혼동 가능. carry-over 권고.

### MEDIUM-2 — `coverage-guard` jq apt-get install: 매 run ~5~13초, Phase 23 까지 누적

`Ensure jq installed` step 은 EPHEMERAL=true 로 컨테이너 재시작 시 jq 소멸 → 매 run `apt-get update -qq` (~3~8초) + `apt-get install -y -qq jq` (~2~5초) 실행. 연간 100 run 가정 시 누적 ~17분. Phase 23 Custom Image 에 jq 사전 포함으로 자연 해소 예정 (pr-5-ci-runs-on.md §Phase 23 carry-over 기명시). 추가 조치 불필요.

---

## LOW (관찰)

- **4 runner pool 포화**: PR push 시 동시 trigger 추정 8 job (ci.yml 2 + e2e 4 shard + security 2) → 4 runner 포화. warm cache 기준 e2e shard ~1분 → ci.yml 최대 ~1분 queue 대기. cold cache 기준 ~5분. `cancel-in-progress: true` 로 중복 push cancel 완화. runner 증설은 Phase 23 검토.
- **docker-build full build 매 run**: EPHEMERAL 로 BuildKit layer cache 소멸 → ~2~4분/run. PR Build Check 목적 (push 없음) 이므로 기능 목표 충족. Phase 23 persistent layer cache 검토 가능.
- **go-check postgres+redis manual startup latency**: warm ~5~15초, cold ~30~60초. PR-168 MEDIUM-PERF-3 와 동일 패턴으로 이미 수용 결정.

---

## carry-over 명시

| 우선순위 | 항목 | 대상 Phase |
|---|---|---|
| P1 (任意) | spec §진단 데이터에 "GHA cache 비용 신규 미발생" 보완 (MEDIUM-1) | Phase 23 이전 任意 |
| P2 | Phase 23 Custom Image 에 jq 사전 포함 (MEDIUM-2) | Phase 23 |
| P3 | runner pool 증설 검토 (LOW-1) | Phase 23 |

---

## 결론

PR-5 는 routing label 4줄 변경이며 성능 관점 **순이익 PR** 이다. bare-host tar 충돌로 무효화되던 `go-check` GHA cache (~369MB, ~10~20초/run) 가 정상화되고, 신규 성능 비용 도입은 없다. `coverage-guard` jq install (~5~13초/run) 은 Phase 23 Custom Image carry-over 로 기명시. HIGH 항목 없음. carry-over MEDIUM-1 spec 보완 후 **conditional pass — 머지 권고**.

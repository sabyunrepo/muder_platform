# PR-5 Test Review

## Verdict: pass

---

## HIGH (regression 위험)

없음.

PR-170 fold-in(PR-8)이 이미 containerized runner 환경의 4대 실질 부채(services block, testcontainers-go docker.sock, jq 부재, docker build permission)를 모두 해소했다. 본 PR은 4줄 routing label 변경만이므로 새로운 regression 경로가 없다.

---

## MEDIUM (gap)

**M-1. `setup-go` hostedtoolcache atomic install 검증 미완**

4 containerized runner가 동일 `hostedtoolcache` named volume(`/opt/hostedtoolcache`)을 공유한다. go-check + ts-check + coverage-guard + docker-build가 동시 trigger될 때 `setup-go`가 동일 Go 1.25 캐시 키로 `/opt/hostedtoolcache/go/1.25.x/...`에 동시 write를 시도할 수 있다.

- **CI가 가릴 수 있는 부분**: 첫 PR run(cold cache)이 통과하면 install 자체는 성공. 동시 4 job race는 coverage-guard가 go-check에 `needs:` 의존하므로 go-check/ts-check 완료 후에야 coverage-guard 기동 → 실제 동시 점유는 go-check + ts-check + docker-build 3 job에 한정.
- **CI가 가릴 수 없는 부분**: `setup-go@v5`의 hostedtoolcache write가 non-atomic일 경우 간헐적 corrupt 가능. 이 경로는 단일 PR run으로 검증 불가(통계적으로 희귀). 현재 캐시 hit이면 write skip → 문제 잠복.

**M-2. fork PR 게이트 부재 (carry-over 명시됨)**

`go-check`의 `sudo go test`와 `sudo docker run`은 host docker.sock에 접근한다. fork PR의 untrusted code가 이 경로로 실행된다면 host runner 환경에 영향 가능. spec의 carry-over 판단(Phase 22 W3)은 적절하나 이 gap은 PR run CI로 검증 불가 — CI가 통과해도 위험이 닫히지 않는다.

---

## LOW (관찰)

**L-1. CI 자체가 regression test인 것의 정당성**

workflow routing 변경의 검증 수단은 PR run의 4 job 통과가 전부이며 이는 정당하다. GHA workflow 파일에 대해 별도 unit test를 작성하는 패턴(act 기반 local run 등)은 이 프로젝트의 CI 철학(실제 runner 환경 사용)과 맞지 않는다. routing label 변경의 부작용은 오직 실제 runner dispatch 결과로만 확인 가능하다.

**L-2. PR-170 1st run의 go-check 선행 검증**

spec의 진단 데이터에 따르면 PR-170 시점 go-check는 `runs-on: self-hosted`(bare-host)로 실행됐고 tar 충돌이 관찰됐다. mockgen drift, WS contract drift, PlayerAware coverage lint 3 step은 해당 run에서 모두 통과했다. 본 PR 전환 후 이 step들은 동일 바이너리(go generate, go run ./cmd/wsgen, bash script)를 containerized runner에서 실행하며 환경 의존성이 없으므로 정상 작동 예상.

**L-3. `Fix coverage.out ownership`의 sudo chown**

containerized runner에서 `sudo go test`가 root:root로 생성한 `coverage.out`을 `sudo chown "$(id -u):$(id -g)"`로 정정하는 패턴은 PR-170 fold-in에서 이미 검증됐다. runner 컨테이너의 UID/GID가 고정된 환경이라면 이 step은 멱등 동작한다.

---

## carry-over

- **Phase 22 W3**: `go-check` fork PR 게이트 (`github.event.pull_request.head.repo.fork == false`)
- **Phase 22 W3**: bare-host runner 등록 해제 (사용자 SSH 직접 작업)
- **Phase 23**: hostedtoolcache write atomic 보장 — custom image에 Go 사전 install → `setup-go` write skip 경로 고정

---

## 결론

4줄 routing 변경의 실질 위험은 PR run CI가 대부분 커버한다. CI가 가릴 수 없는 위험은 M-1(hostedtoolcache write race, 통계적 희귀)과 M-2(fork PR sudo 실행, carry-over 명시)이며 모두 이 PR의 scope 밖 판단이 이미 spec에 문서화됐다. 4-agent 리뷰 선행 없이 admin-merge 하는 경우가 아닌 한 pass 판정이 적절하다.

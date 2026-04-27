# Sim Case A — PR-2c handleCombine deadlock 재현 (PR-10 검증)

`/compound-review` 4-agent가 PR-2c (#107)의 deadlock latent를 잡아낼 수 있는지 입증하는 시뮬레이션 카논. PR-10 진입 시 실제 패치 파일 + 실행 절차를 작성한다. 본 ref는 **계약(contract)**.

## 목표

PR-2c (#107) 머지 시 4-agent 리뷰를 스킵해 admin-merge → 사후 발견된 `handleCombine` Publish-after-Unlock deadlock 위험. compound-mmp `/compound-review`가 동일 결함을 **사전에** HIGH로 잡아냈을 것임을 입증.

## 사전 조사 (PR-10 진입 시점)

### Step 0 — 정확한 base SHA 확인

```bash
# PR-2c (#107) 머지 commit + hotfix #108 commit 둘 다 squash 가능성 있음
git log --oneline --all | grep -iE "PR-2c|handleCombine|deadlock|#107|#108" | head -10

# combination 모듈 디렉토리 변경 이력
git log --oneline --follow -- apps/server/internal/modules/combination/ | head -20

# handleCombine 함수의 Publish 위치
git log -S "Publish" --oneline -- apps/server/internal/modules/combination/ | head -10
```

`0b31271^`이 squash로 사라졌다면, 가장 가까운 base는 PR-2c 머지 직전 main HEAD (PR-2b 또는 PR-3 머지 이후 commit).

### Step 1 — 패치 파일 작성 (`refs/sim-case-a.patch`)

기대 패치 형태:
```diff
--- a/apps/server/internal/modules/combination/combination.go
+++ b/apps/server/internal/modules/combination/combination.go
@@ -<line>,<count> +<line>,<count> @@ func (m *Module) handleCombine(...) {
   m.mu.Lock()
   defer m.mu.Unlock()

   // ... craft logic ...

-  m.publish(ctx, evt)   // 외부에서 Publish (lock 해제 후)
+  m.bus.Publish(ctx, evt)   // ★ lock 보유 중 Publish — bus 측 lock과 deadlock 가능
}
```

핵심: `defer m.mu.Unlock()`이 활성 상태에서 `bus.Publish`를 호출하면, EventBus 내부 broadcast lock과 `m.mu` 사이에 ABBA deadlock 가능 (다른 goroutine이 bus lock 보유 중 craft 콜백으로 m.mu 요청 시).

### Step 2 — 패치 적용 + 빌드

```bash
git checkout -b sim/case-a-handleCombine-deadlock <base-SHA>
git apply .claude/plugins/compound-mmp/refs/sim-case-a.patch
cd apps/server && go build ./...
```

빌드 통과 확인. 실패 시 (예: `bus` 필드명 차이) PR-10 시점에 패치 보정.

### Step 3 — `/compound-review sim-case-a` 실행

4-agent 병렬 spawn. 각자에게 다음 컨텍스트:
- diff: 위 패치 hunk
- design: `apps/server/CLAUDE.md` 모듈 시스템 + `memory/project_phase19_implementation_progress.md`의 deadlock 사례
- pr_id: `sim-case-a`, pr_title: `PR-2c handleCombine deadlock 재현`

## 기대 출력

| Agent | 기대 분류 | 기대 키워드 |
|-------|-----------|------------|
| `oh-my-claudecode:security-reviewer` | LOW or MEDIUM | "deadlock으로 인한 가용성 저하" 또는 "DoS 가능성" |
| `oh-my-claudecode:code-reviewer` | **HIGH** | "lock contention", "Publish-after-Unlock 위반", "ABBA" |
| `oh-my-claudecode:critic` | **HIGH** | "design pattern 위반", "actor model 부재", "hot-path lock" |
| `oh-my-claudecode:test-engineer` | MEDIUM | "race test 누락", "동시성 시나리오 부족" |

## Pass 기준

- HIGH 분류 ≥ 1건 (code-reviewer 또는 critic)
- 4 agent 응답 모두 정상 (timeout/error 없음)
- HIGH 응답에 `lock` 또는 `deadlock` 키워드 포함

## Fail 시 조치

1. 각 agent prompt를 `.claude/post-task-pipeline.json`에서 강화 (예: "race condition / lock-in-lock 패턴 적극 탐지" 추가)
2. patch hunk를 더 명확히 (주석 추가)
3. critic agent에 ADVERSARIAL 모드 강제 토큰 추가
4. 재실행. 3회 시도 후에도 fail 시 — 4-agent 자체 탐지 한계로 결론, 별도 race 탐지 도구 (예: `go test -race -count=1`) 의존성 카논화

## "한 메시지 4 Task spawn" 검증 (test CRITICAL C-2)

`/compound-review`에 `--dry-run` 플래그 추가 (PR-7 진입 시점):
```bash
/compound-review sim-case-a --dry-run
# stdout: [{"subagent_type":"...","model":"...","prompt":"..."}, ...] (jq parsable)
```

CI/dogfood에서:
```bash
/compound-review sim-case-a --dry-run | jq 'length == 4' | grep -q true || echo "FAIL: not 4 parallel"
```

## 책임 분리

- 본 ref(`sim-case-a.md`)는 **PR-1 (scaffold) 시점에서 카논화**된 계약. 실제 patch + 실행은 PR-10에서.
- patch 파일 (`sim-case-a.patch`)은 PR-10 진입 시 추가. 현 시점 placeholder 없음 (불필요).
- base SHA 확정도 PR-10 (Phase 19 Residual W4 종료 후).

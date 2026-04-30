# ARC on KT Cloud KS

GitHub Actions Self-hosted Runner를 KT Cloud Managed KS(`github-actions-runner`)에서 ARC(Actions Runner Controller)로 동적 운용한다.

> 운영 절차서: [`docs/runbooks/kt-cloud-arc-setup.md`](../../../docs/runbooks/kt-cloud-arc-setup.md)
> (PR #178 — 머지 후 링크 활성화)

## 현재 구성

- 클러스터: `github-actions-runner` (1.33.7, containerd 2.2.2, Calico, Private 티어)
- ARC chart: `gha-runner-scale-set-controller@0.14.1` + `gha-runner-scale-set@0.14.1`
- Runner 이미지: `ghcr.io/sabyunrepo/mmp-runner:latest` (build-runner-image.yml 자동 build/push, Phase 24 actions-runner 베이스). KT registry mirror (`registry.cloud.kt.com/dldxu5p5/mmp-runner:latest`) 는 fallback 으로 imagePullSecrets 에 함께 유지.
- Container mode: **DinD sidecar** (`containerMode.type: dind`) — 노드가 containerd 전용이라 `/var/run/docker.sock` 없음
- Runner pool: `arc-runner-set` namespace=`arc-runners`, min 0 / max 5
- GitHub config: `https://github.com/sabyunrepo/muder_platform`

## 파일

| 파일 | 용도 |
|------|------|
| `values-runner-set.yaml` | RunnerScaleSet helm values (Path B / DinD) |

## 재배포 명령

```bash
export KUBECONFIG=~/.kube/kt-cloud-config
helm upgrade --install arc-runner-set \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  --namespace arc-runners \
  -f infra/k8s/arc/values-runner-set.yaml
```

> ⚠️ helm v3 사용 권장. helm v4는 chart 0.14.1과 lookup 호환성 이슈 발생 (`serviceaccounts ... not found`). v3.16.x로 설치.

## 사전 조건

- `arc-systems` ns에 controller 설치 (`helm install arc oci://.../gha-runner-scale-set-controller`)
- `arc-runners` ns에 secret:
  - `github-pat-secret` — `github_token=<PAT>` (scope: `repo`, `workflow`) — ARC controller registration
  - `ghcr-secret` — `docker-registry` 타입, GitHub PAT(`read:packages` scope) — runner image pull
  - `kt-registry-secret` — KT Cloud Container Registry docker creds (fallback 미러)
- 노드 outbound: `0.0.0.0/0:443` 허용 (ghcr.io, api.github.com, broker.actions.githubusercontent.com)

## 사용

GitHub Actions workflow:
```yaml
runs-on: arc-runner-set
```

스모크 테스트: `.github/workflows/arc-smoke-test.yml` (workflow_dispatch 수동 트리거)

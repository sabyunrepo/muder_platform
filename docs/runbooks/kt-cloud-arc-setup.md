# KT Cloud KS — Actions Runner Controller (ARC) 설치 런북

KT Cloud Managed KS(`github-actions-runner`, DX-M1)에 GitHub Actions Self-hosted Runner를
ARC로 동적 운용하는 환경 구축 절차. STEP 0 → STEP 9 순서대로 실행.

> ⚠️ **보안 경고** — PAT, Registry KEY, kubeconfig를 채팅창·코드·커밋에 평문으로 절대 붙이지 말 것.
> 모든 자격증명은 환경변수 또는 kubectl secret 명령으로만 주입.

---

## STEP 0 — 사전 점검 (Prerequisites)

### 도구 설치

```bash
# Homebrew (macOS)
brew install kubectl helm

# asdf 사용 시
asdf plugin add kubectl && asdf install kubectl 1.33.0
asdf plugin add helm   && asdf install helm   3.17.0

# 버전 확인 — client는 server(1.33.7)와 ±1 minor 이내 권장 (1.32~1.34)
kubectl version --client
helm version
```

### kubeconfig 설정

1. KT Cloud 콘솔 → Managed KS → `github-actions-runner` 클러스터 상세 → **Kubeconfig 복사**
2. 저장 및 권한 설정:

```bash
mkdir -p ~/.kube
# 콘솔에서 복사한 내용을 아래 파일에 붙여넣기 (편집기 사용 권장)
vi ~/.kube/kt-cloud-config
chmod 600 ~/.kube/kt-cloud-config
```

3. 환경변수 설정 (`direnv .envrc` 패턴 권장):

```bash
# .envrc (프로젝트 루트)
export KUBECONFIG=~/.kube/kt-cloud-config

# 즉시 적용
export KUBECONFIG=~/.kube/kt-cloud-config
```

### 연결 검증

```bash
kubectl get nodes
kubectl version
kubectl get ns
```

`runner-ng` 노드가 `Ready` 상태이면 STEP 2로 진행.

---

## STEP 1 — 로컬 환경 준비

STEP 0 완료 시 Skip. STEP 0이 완료된 상태를 전제로 진행.

---

## STEP 2 — PSA 정책 확인 및 Path 결정

### PSA 레이블 조회

```bash
kubectl get ns --show-labels | grep -E 'pod-security|NAME'
```

### CRI 확인

```bash
kubectl get nodes -o jsonpath='{.items[*].status.nodeInfo.containerRuntimeVersion}'
```

### hostPath dry-run 테스트

```bash
cat <<'EOF' | kubectl apply --dry-run=server -f -
apiVersion: v1
kind: Pod
metadata:
  name: psa-test
  namespace: default
spec:
  containers:
  - name: test
    image: busybox
    volumeMounts:
    - mountPath: /var/run/docker.sock
      name: docker-sock
  volumes:
  - name: docker-sock
    hostPath:
      path: /var/run/docker.sock
EOF
```

### 결정 트리

| dry-run 결과 | 선택 경로 | 비고 |
|---|---|---|
| `pod/psa-test created (server dry run)` | **Path A** — hostPath docker.sock 마운트 | privileged 없이 가능 |
| `violates PodSecurity policy` 오류 | **Path B** — DinD sidecar 방식 | privileged sidecar 필요 |

> KT Cloud KS 1.33 기본 PSA는 `baseline`이 일반적이며, hostPath docker.sock 마운트를 차단할 가능성이 70-80%입니다. dry-run 결과를 반드시 확인 후 Path를 선택하세요.

---

## STEP 3 — GitHub 인증 + namespace 생성

```bash
# namespace 생성
kubectl create ns arc-systems
kubectl create ns arc-runners

# GitHub PAT secret 생성 (arc-systems 네임스페이스)
kubectl create secret generic github-pat-secret \
  --namespace arc-systems \
  --from-literal=github_token=<YOUR_GITHUB_PAT>

# arc-runners 에도 동일하게 생성 (RunnerScaleSet이 참조)
kubectl create secret generic github-pat-secret \
  --namespace arc-runners \
  --from-literal=github_token=<YOUR_GITHUB_PAT>
```

> ⚠️ `<YOUR_GITHUB_PAT>`을 실제 값으로 교체. 필요 scope: `repo`, `workflow`.
> 터미널 히스토리에서 제거: `history -d $(history 1 | awk '{print $1}')`

> 운영 권장 — GitHub App 방식은 PAT 만료·노출 위험을 근본 제거합니다.
> 참고: [ARC GitHub App 인증](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/authenticating-to-the-github-api)

---

## STEP 4 — KT Cloud Container Registry pull secret

```bash
kubectl create secret docker-registry kt-registry-secret \
  --namespace arc-runners \
  --docker-server=registry.cloud.kt.com \
  --docker-username=<APP_KEY> \
  --docker-password=<CLI_KEY>
```

> KT Cloud 콘솔 → Container Registry → KEY 조회 → 마스킹 해제: APP KEY = username, CLI KEY = password

### 검증 (값 노출 없이 구조만 확인)

```bash
kubectl get secret kt-registry-secret -n arc-runners \
  -o jsonpath='{.data.\.dockerconfigjson}' | base64 -d | python3 -m json.tool | grep -v '"auth"'
```

---

## STEP 5 — ARC Controller 설치

```bash
helm install arc \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set-controller \
  --namespace arc-systems \
  --version <LATEST_STABLE_VERSION>
  # 예: --version 0.9.3
  # 최신 버전 확인: https://github.com/actions/actions-runner-controller/releases
```

### 설치 검증

```bash
kubectl -n arc-systems get pods,deploy,sa
# arc-gha-runner-scale-set-controller-* Pod가 Running 상태여야 함
```

### 트러블슈팅

| 증상 | 조치 |
|---|---|
| `ImagePullBackOff` | ghcr.io 아웃바운드 443 허용 확인 |
| `CrashLoopBackOff` | `kubectl -n arc-systems logs <pod>` → CRD 미생성 시 `helm status arc -n arc-systems` |
| RBAC 오류 | `kubectl get clusterrolebinding \| grep arc` 확인 후 helm 재설치 |

---

## STEP 6 — RunnerScaleSet 배포 (Path A / Path B 분기)

### 공통 values.yaml 기반

```yaml
# values-base.yaml
githubConfigUrl: "https://github.com/sabyunrepo/muder_platform"
githubConfigSecret: "github-pat-secret"

minRunners: 0
maxRunners: 5

imagePullSecrets:
  - name: kt-registry-secret

template:
  spec:
    containers:
      - name: runner
        image: registry.cloud.kt.com/dldxu5p5/mmp-runner:latest
```

### Path A — hostPath docker.sock 마운트

```yaml
# values-path-a.yaml (위 base에 병합)
template:
  spec:
    containers:
      - name: runner
        image: registry.cloud.kt.com/dldxu5p5/mmp-runner:latest
        env:
          - name: DOCKER_HOST
            value: unix:///var/run/docker.sock
        volumeMounts:
          - mountPath: /var/run/docker.sock
            name: docker-sock
        securityContext:
          privileged: false
    volumes:
      - name: docker-sock
        hostPath:
          path: /var/run/docker.sock
```

```bash
helm install arc-runner-set \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  --namespace arc-runners \
  -f values-base.yaml -f values-path-a.yaml
```

### Path B — DinD sidecar 방식

> ⚠️ **보안 trade-off** — DinD sidecar는 `privileged: true`가 필수이며, 노드 탈출(escape) 위험이 있습니다.
> 운영 시 전용 node group 격리 또는 Kata Containers / gVisor 샌드박스 도입을 검토하세요.
> 참고: [Kata Containers](https://katacontainers.io/), [gVisor](https://gvisor.dev/)

```yaml
# values-path-b.yaml
template:
  spec:
    initContainers: []
    containers:
      - name: runner
        image: registry.cloud.kt.com/dldxu5p5/mmp-runner:latest
        env:
          - name: DOCKER_HOST
            value: tcp://localhost:2375
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        volumeMounts:
          - mountPath: /home/runner/_work
            name: work

      - name: dind
        image: docker:28-dind
        env:
          - name: DOCKER_TLS_CERTDIR
            value: ""
        securityContext:
          privileged: true
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        volumeMounts:
          - mountPath: /home/runner/_work
            name: work

    volumes:
      - name: work
        emptyDir: {}
```

```bash
helm install arc-runner-set \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  --namespace arc-runners \
  -f values-base.yaml -f values-path-b.yaml
```

---

## STEP 7 — GitHub Actions workflow 연결

### ARC 전용 runs-on 라벨

`arc-runner-set`은 RunnerScaleSet 이름과 동일한 라벨로 매칭됩니다.
기존 `self-hosted` 또는 `myoung34` 라벨과 충돌하지 않습니다.

```yaml
# .github/workflows/example-arc.yml
name: ARC smoke test
on:
  workflow_dispatch:

jobs:
  smoke:
    runs-on: arc-runner-set   # RunnerScaleSet name 그대로 사용
    steps:
      - uses: actions/checkout@v4
      - run: echo "ARC runner is working" && docker version
```

### 점진적 cutover 가이드

1. 먼저 가장 가벼운 workflow 1개(예: lint)만 `runs-on: arc-runner-set`으로 변경
2. 1주 동안 Pod 생성/삭제 사이클 관찰
3. 문제 없으면 CI workflow 순서대로 점진적 확대
4. 기존 호스트 runner(`myoung34` 레이블) 정리는 Phase 25 후속으로 이관

---

## STEP 8 — 동작 검증

```bash
# Runner Pod watch
kubectl -n arc-runners get pods -w

# Cluster Autoscaler 스케일링 관찰
kubectl get nodes -w

# Runner 로그 (Path A)
kubectl -n arc-runners logs <pod-name> -c runner

# Runner + DinD 로그 (Path B)
kubectl -n arc-runners logs <pod-name> -c runner
kubectl -n arc-runners logs <pod-name> -c dind
```

GitHub Actions UI → workflow_dispatch로 수동 트리거 후:
- Pod 생성 → job 실행 → Pod 자동 삭제 확인
- max 도달 시 `runner-ng` 노드 증가 (Cluster Autoscaler), idle 후 감소 확인

---

## STEP 9 — 운영 고려사항

### Scale Down 정책

```bash
# cluster-autoscaler ConfigMap 확인
kubectl -n kube-system get configmap cluster-autoscaler-status -o yaml
# scale-down-unneeded-time 기본 10m — 짧은 job churn 시 15~20m으로 조정
```

### Runner 이미지 업데이트

```bash
helm upgrade arc-runner-set \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  --namespace arc-runners \
  -f values-base.yaml -f values-path-b.yaml \
  --set template.spec.containers[0].image=registry.cloud.kt.com/dldxu5p5/mmp-runner:<NEW_TAG>
```

### 아웃바운드 통신 확인

```bash
# NAT Gateway 통해 GitHub API 도달 가능 여부 확인
kubectl run curl-test --image=curlimages/curl --restart=Never --rm -it -- \
  curl -s -o /dev/null -w "%{http_code}" https://api.github.com
# 200이면 정상
```

방화벽 허용 필요 도메인:
- `api.github.com` — ARC 등록
- `*.actions.githubusercontent.com` — artifact 다운로드
- `registry.cloud.kt.com` — 이미지 pull

### 모니터링

```bash
kubectl top pods -n arc-runners
kubectl top nodes
# ARC controller metrics: kubectl -n arc-systems port-forward svc/arc-metrics 8080:8080
```

### 백업 / DR

```bash
# helm release manifest export
helm get manifest arc-runner-set -n arc-runners > arc-runner-set-manifest.yaml
helm get values   arc-runner-set -n arc-runners > arc-runner-set-values.yaml
```

---

## 트러블슈팅 매트릭스

| # | 증상 | 원인 후보 | 진단 명령 | 해결 |
|---|---|---|---|---|
| 1 | `kubectl get nodes` Connection refused | kubeconfig 경로 오류 / VPN 미연결 | `echo $KUBECONFIG` | kubeconfig 재설정, VPN 연결 확인 |
| 2 | PSA dry-run "violates PodSecurity" | PSA baseline/restricted 적용 | STEP 2 dry-run 결과 | Path B(DinD)로 전환 |
| 3 | ARC controller CrashLoopBackOff | CRD 미생성 / RBAC 부족 | `kubectl -n arc-systems logs <pod>` | `helm uninstall arc -n arc-systems && helm install` 재실행 |
| 4 | RunnerScaleSet Pod ImagePullBackOff | kt-registry-secret 누락 / KEY 만료 | `kubectl -n arc-runners get secret` | secret 재생성, KEY 콘솔에서 재조회 |
| 5 | Pod 생성됐으나 GitHub에 runner 미등록 | PAT scope 부족 / githubConfigUrl 오타 | `kubectl -n arc-runners logs <listener-pod>` | PAT `repo`+`workflow` scope 확인, URL 재검증 |
| 6 | Runner Pod Pending | cpu/memory 부족 / Autoscaler max 도달 | `kubectl describe pod <pod> -n arc-runners` | resources 요청 축소 또는 maxRunners 재조정 |
| 7 | `runs-on: arc-runner-set` 매칭 안 됨 | RunnerScaleSet 이름 불일치 | `kubectl -n arc-runners get runnerscaleset` | helm release 이름 == `runs-on` 값 일치 확인 |
| 8 | DinD `Cannot connect to docker daemon` | DOCKER_HOST env 누락 | `kubectl -n arc-runners exec <pod> -c runner -- env \| grep DOCKER` | values에 `DOCKER_HOST: tcp://localhost:2375` 추가 |
| 9 | controller log "context deadline exceeded" | NAT Gateway 미설정 → GitHub API 차단 | STEP 9 curl-test pod 실행 | KT Cloud 콘솔 NAT Gateway 설정, 방화벽 443 허용 |
| 10 | Cluster Autoscaler scale-down 과속 | unneeded-time 짧음 → 단발 job churn | `kubectl -n kube-system logs -l app=cluster-autoscaler` | `--scale-down-unneeded-time=15m` 이상으로 조정 |
| 11 | controller log "401 Unauthorized" | PAT 만료 | `kubectl -n arc-systems get secret github-pat-secret` | 새 PAT 발급 후 secret 재생성 후 controller Pod 재시작 |
| 12 | controller 정상이지만 runner 0개 고정 | minRunners=0 + listener Pod 부재 | `kubectl -n arc-runners get pods` | listener Pod 로그 확인 (`-c listener`), workflow 수동 트리거 후 Pod 생성 유도 |

---

## 참고 자료

- [ARC 공식 문서](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller)
- [ARC Helm Chart (GitHub Releases)](https://github.com/actions/actions-runner-controller/releases)
- [KT Cloud Managed Kubernetes Service 공식 문서](<KT_CLOUD_MANAGED_KS_DOCS_URL>)
- [GitHub PAT 생성 가이드](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [GitHub App 인증 전환 가이드](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/authenticating-to-the-github-api)

---

최초 작성: 2026-04-29 | 다음 갱신 예정: ARC chart bump 시

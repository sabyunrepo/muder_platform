#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-}"
REGISTRY="${KT_REGISTRY_HOST:-registry.cloud.kt.com}"
NAMESPACE="${KT_REGISTRY_NAMESPACE:-dldxu5p5}"
IMAGE="${REGISTRY}/${NAMESPACE}/mmp-runner:${TAG}"
VALUES_FILE="${VALUES_FILE:-infra/k8s/arc/values-runner-set.yaml}"
NAMESPACE_K8S="${ARC_NAMESPACE:-arc-runners}"
RELEASE="${ARC_RELEASE:-arc-runner-set}"

if [[ -z "${TAG}" ]]; then
  echo "usage: $0 <versioned-tag>" >&2
  exit 64
fi

if [[ "${TAG}" == "latest" ]]; then
  echo "FAIL: latest is not allowed for ARC runner values" >&2
  exit 65
fi

echo "# Registry"
docker buildx imagetools inspect "${IMAGE}" | sed -n '1,30p'

echo
echo "# Repo values"
if ! grep -Fq "image: ${IMAGE}" "${VALUES_FILE}"; then
  echo "FAIL: ${VALUES_FILE} does not point to ${IMAGE}" >&2
  exit 66
fi
grep -n "image: .*mmp-runner" "${VALUES_FILE}"

echo
echo "# Helm values"
HELM_VALUES="$(helm get values "${RELEASE}" -n "${NAMESPACE_K8S}" -o yaml)"
printf '%s\n' "${HELM_VALUES}" | grep -n "image: .*mmp-runner" || true
if ! printf '%s\n' "${HELM_VALUES}" | grep -Fq "image: ${IMAGE}"; then
  echo "FAIL: helm release ${RELEASE} does not point to ${IMAGE}" >&2
  exit 67
fi

echo
echo "# Runner pods"
kubectl -n "${NAMESPACE_K8S}" get pods \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.phase}{"\t"}{range .spec.containers[*]}{.name}{":"}{.image}{" "}{end}{"\n"}{end}'

RUNNING_WITH_TAG="$(kubectl -n "${NAMESPACE_K8S}" get pods \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.phase}{"\t"}{range .spec.containers[*]}{.name}{":"}{.image}{" "}{end}{"\n"}{end}' \
  | awk -v image="${IMAGE}" '$2 == "Running" && index($0, image) { count++ } END { print count + 0 }')"

if [[ "${RUNNING_WITH_TAG}" -lt 1 ]]; then
  echo "FAIL: no Running ARC runner pod uses ${IMAGE}" >&2
  exit 68
fi

echo
echo "PASS: ${RUNNING_WITH_TAG} Running runner pod(s) use ${IMAGE}"

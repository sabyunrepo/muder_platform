# 정보별 장면 시작 배포 설정

## 목표

- 정보관리의 각 정보에서 게임 진행 플로우의 장면을 선택해, 해당 장면 시작 시 정보를 전체 캐릭터 또는 특정 캐릭터에게 배포하도록 설정한다.
- 저장 위치는 별도 `story_info` 필드가 아니라 런타임이 이미 읽는 `flow_nodes.data.onEnter`의 `DELIVER_INFORMATION` 액션으로 둔다.

## 범위

- 정보 상세 화면 아래에 `장면 시작 배포` 섹션을 추가한다.
- 장면별 배포 대상은 `배포 안 함`, `전체 캐릭터`, `캐릭터 선택`으로 편집한다.
- 기존 장면 시작 액션의 다른 정보 배포, 단서 지급, BGM 등은 유지한다.

## Coverage Plan

- `infoDeliverySettingsAdapter.test.ts`
  - 정보별 배포 대상 읽기
  - 특정 정보만 대상 변경
  - 다른 정보와 단서 지급 액션 보존
  - 배포 안 함으로 변경 시 정보 배포 제거
- `InfoTab.test.tsx`
  - 정보 상세에서 배포 설정 섹션 노출
  - 장면 시작 배포 대상을 특정 캐릭터로 저장하는 사용자 흐름

## 검증

- `pnpm --filter @mmp/web test -- infoDeliverySettingsAdapter.test.ts InfoTab.test.tsx`
- `pnpm --filter @mmp/web typecheck`
- `pnpm --filter @mmp/web lint`
- `scripts/mmp-local-ci.sh quick`

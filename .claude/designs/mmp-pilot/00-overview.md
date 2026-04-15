# mmp-pilot — 통합 시스템 설계 (Overview)

> plan-* 체계 + mmp 하네스를 병합한 단일 신규 시스템. A/B 자기개선 루프 포함.

## 1. 시스템 이름 + 설계 요약

**이름: `mmp-pilot`** (alias: `/plan-go`)

plan-autopilot의 wave 스케줄러·워크트리 엔진 위에, mmp 하네스의 6인 전문가 팀·공용 스킬·QMD/200줄 규칙을 얹은 **3-Layer 파일럿**. 단일 진입점 `/plan-go`에서 wave 자동 실행·단일 task·재개·중단·상태·아카이브를 모두 파생한다. 산출물은 `.claude/runs/{run-id}/…`로 일원화, 상태 스키마는 `active-plan.json` 확장. 옵션 `--ab`로 variant A/B 병렬 실행 → 메트릭 수집 → 자동 proposal → 검증된 것만 실제 파일 적용하는 자기개선 루프를 돌린다. 200줄 하드 리밋·QMD 우선·docs/plans 구조는 불변.

## 2. 3-Layer 다이어그램

```
┌────────────────────────────────────────────────────┐
│ Layer 1 — Pilot Orchestrator                       │
│   • wave 루프 / worktree 수명 / 락 관리            │
│   • scope enforcement / SUMMARY 파싱               │
│   • A/B 러너 / metric 수집 / proposal 생성         │
└─────────┬──────────────────────────────────────────┘
          │ task 위임 (per PR per worktree)
┌─────────▼──────────────────────────────────────────┐
│ Layer 2 — Dynamic Expert Team (session-scoped)     │
│   docs-navigator · go-backend · react-frontend     │
│   module-architect · test-engineer · security-rev  │
│   (2~6명 동적 편성 · TeamCreate 또는 서브에이전트) │
└─────────┬──────────────────────────────────────────┘
          │ 공용 스킬 참조
┌─────────▼──────────────────────────────────────────┐
│ Layer 3 — Shared Skills                            │
│   mmp-qmd-first · mmp-200-line-rule                │
│   mmp-module-factory · mmp-test-strategy           │
│   mmp-security-rfc9457                             │
└────────────────────────────────────────────────────┘
```

## 3. 단일 진입점 커맨드 스펙

**`/plan-go`** (autopilot 후계, 모든 실행 경로의 입구)

| 플래그 | 동작 | 기본값 | 예시 |
|--------|------|--------|------|
| (없음) | 현재 wave부터 순차 실행 | resume | `/plan-go` |
| `--wave W2` | 특정 wave만 실행 | - | `/plan-go --wave W1` |
| `--task "id"` | 단일 task 실행(ad-hoc) | - | `/plan-go --task "M-7"` |
| `--until W3` | 해당 wave까지 실행 후 정지 | - | `/plan-go --until W2` |
| `--dry-run` | 매니페스트만 출력, 실행 X | false | `/plan-go --dry-run` |
| `--ab <exp>` | A/B 러너 모드(샌드박스) | off | `/plan-go --ab team-size` |
| `--team N` | 팀 크기 상한(2-6) | auto | `/plan-go --team 4` |
| `--resume` | 마지막 run_id 이어받기 | auto | `/plan-go --resume` |
| `--force-unlock` | stale 락 강제 해제 후 실행 | false | `/plan-go --force-unlock` |

보조 커맨드(유지 + 스키마 업그레이드): `/plan-new`, `/plan-start`, `/plan-status`, `/plan-tasks`, `/plan-resume`, `/plan-stop`, `/plan-finish`

**deprecated**: `/plan-autopilot` → /plan-go alias(Phase 1), 경고(Phase 2), 제거(Phase 3)

import type { ClueResponse, LocationResponse } from "@/features/editor/api";

export interface RoundVisibilityItem {
  id: string;
  name: string;
  scheduleLabel: string;
}

export interface RoundVisibilityWarning {
  id: string;
  message: string;
}

export interface RoundVisibilityPreview {
  round: number;
  label: string;
  clues: RoundVisibilityItem[];
  locations: RoundVisibilityItem[];
  warnings: RoundVisibilityWarning[];
}

function formatScheduleLabel(from: number | null | undefined, to: number | null | undefined): string {
  if (from == null && to == null) return "항상 공개";
  if (from != null && to != null) return from === to ? `${from}라운드만` : `${from}~${to}라운드`;
  if (from != null) return `${from}라운드부터`;
  return `${to}라운드까지`;
}

function hasInvalidRange(from: number | null | undefined, to: number | null | undefined): boolean {
  return from != null && to != null && from > to;
}

function isVisibleInRound(
  round: number,
  from: number | null | undefined,
  to: number | null | undefined,
): boolean {
  if (hasInvalidRange(from, to)) return false;
  return (from ?? 1) <= round && round <= (to ?? Number.POSITIVE_INFINITY);
}

function maxFiniteRound(values: Array<number | null | undefined>): number {
  return values.reduce((max, value) => (value != null && value > max ? value : max), 0);
}

export function buildRoundVisibilityPreview(
  clues: ClueResponse[] = [],
  locations: LocationResponse[] = [],
  minRounds = 3,
): RoundVisibilityPreview[] {
  const maxRound = Math.max(
    minRounds,
    maxFiniteRound(clues.flatMap((clue) => [clue.reveal_round, clue.hide_round])),
    maxFiniteRound(locations.flatMap((location) => [location.from_round, location.until_round])),
  );
  const locationById = new Map(locations.map((location) => [location.id, location]));

  return Array.from({ length: maxRound }, (_, index) => {
    const round = index + 1;
    const visibleLocations = locations.filter((location) =>
      isVisibleInRound(round, location.from_round, location.until_round),
    );
    const visibleLocationIds = new Set(visibleLocations.map((location) => location.id));
    const visibleClues = clues.filter((clue) =>
      isVisibleInRound(round, clue.reveal_round, clue.hide_round),
    );
    const warnings: RoundVisibilityWarning[] = [];

    for (const location of locations) {
      if (hasInvalidRange(location.from_round, location.until_round)) {
        warnings.push({
          id: `location-range:${location.id}`,
          message: `${location.name} 장소의 등장/퇴장 라운드가 서로 맞지 않습니다.`,
        });
      }
    }

    for (const clue of clues) {
      if (hasInvalidRange(clue.reveal_round, clue.hide_round)) {
        warnings.push({
          id: `clue-range:${clue.id}`,
          message: `${clue.name} 단서의 공개/사라짐 라운드가 서로 맞지 않습니다.`,
        });
        continue;
      }

      if (!isVisibleInRound(round, clue.reveal_round, clue.hide_round) || !clue.location_id) {
        continue;
      }

      const location = locationById.get(clue.location_id);
      if (!location) {
        warnings.push({
          id: `missing-location:${clue.id}`,
          message: `${clue.name} 단서가 삭제되었거나 찾을 수 없는 장소에 연결되어 있습니다.`,
        });
        continue;
      }
      if (!visibleLocationIds.has(location.id)) {
        warnings.push({
          id: `hidden-location:${clue.id}:${round}`,
          message: `${clue.name} 단서는 공개되지만 ${location.name} 장소는 이 라운드에 보이지 않습니다.`,
        });
      }
    }

    return {
      round,
      label: `${round}라운드`,
      clues: visibleClues.map((clue) => ({
        id: clue.id,
        name: clue.name,
        scheduleLabel: formatScheduleLabel(clue.reveal_round, clue.hide_round),
      })),
      locations: visibleLocations.map((location) => ({
        id: location.id,
        name: location.name,
        scheduleLabel: formatScheduleLabel(location.from_round, location.until_round),
      })),
      warnings,
    };
  });
}

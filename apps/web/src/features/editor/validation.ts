// ---------------------------------------------------------------------------
// Game Design Validation Utility
// ---------------------------------------------------------------------------

export interface DesignWarning {
  type: 'warning' | 'error';
  category: 'phases' | 'clues' | 'characters' | 'modules' | 'clue_graph';
  message: string;
}

/**
 * Validates game design config_json and returns a list of warnings/errors.
 *
 * @param configJson  - Parsed config_json from EditorThemeResponse
 * @param clueCount   - Total number of clues defined for the theme
 * @param characterCount - Total number of characters defined for the theme
 */
export function validateGameDesign(
  configJson: Record<string, unknown>,
  clueCount: number,
  characterCount: number,
): DesignWarning[] {
  const warnings: DesignWarning[] = [];

  // ── Phases ──────────────────────────────────────────────────────────────
  const phases = configJson['phases'];
  if (!Array.isArray(phases) || phases.length === 0) {
    warnings.push({
      type: 'error',
      category: 'phases',
      message: '페이즈가 설정되지 않았습니다',
    });
  }

  // ── Modules ─────────────────────────────────────────────────────────────
  const modules = configJson['modules'];
  if (!Array.isArray(modules) || modules.length === 0) {
    warnings.push({
      type: 'error',
      category: 'modules',
      message: '활성 모듈이 없습니다',
    });
  }

  // ── Clue placement ───────────────────────────────────────────────────────
  const cluePlacement = configJson['clue_placement'];
  if (clueCount > 0) {
    const placedCount =
      cluePlacement != null && typeof cluePlacement === 'object'
        ? Object.keys(cluePlacement as Record<string, unknown>).length
        : 0;
    const unplaced = clueCount - placedCount;
    if (unplaced > 0) {
      warnings.push({
        type: 'warning',
        category: 'clues',
        message: `${unplaced}개 단서가 장소에 배치되지 않았습니다`,
      });
    }
  }

  // ── Character clue assignment ────────────────────────────────────────────
  const characterClues = configJson['character_clues'];
  if (characterCount > 0) {
    const assignedCount =
      characterClues != null && typeof characterClues === 'object'
        ? Object.keys(characterClues as Record<string, unknown>).length
        : 0;
    const unassigned = characterCount - assignedCount;
    if (unassigned > 0) {
      warnings.push({
        type: 'warning',
        category: 'characters',
        message: `${unassigned}명의 캐릭터에 시작 단서가 배정되지 않았습니다`,
      });
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Clue Relation Graph Validation
// ---------------------------------------------------------------------------

interface ClueRelationInput {
  sourceId: string;
  targetId: string;
  mode: string;
}

interface ClueInput {
  id: string;
  name: string;
}

export function validateClueGraph(
  relations: ClueRelationInput[],
  clues: ClueInput[],
): DesignWarning[] {
  const warnings: DesignWarning[] = [];

  // 1. Self-reference check
  for (const r of relations) {
    if (r.sourceId === r.targetId) {
      const clue = clues.find((c) => c.id === r.sourceId);
      warnings.push({
        type: 'error',
        category: 'clue_graph',
        message: `자기 자신을 참조하는 관계: ${clue?.name ?? r.sourceId}`,
      });
    }
  }

  // 2. Cycle detection (Kahn's algorithm)
  const clueIds = new Set(clues.map((c) => c.id));
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const id of clueIds) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }
  for (const r of relations) {
    if (r.sourceId === r.targetId) continue;
    adj.get(r.sourceId)?.push(r.targetId);
    inDegree.set(r.targetId, (inDegree.get(r.targetId) ?? 0) + 1);
  }
  const queue = [...inDegree.entries()]
    .filter(([, d]) => d === 0)
    .map(([id]) => id);
  let visited = 0;
  while (queue.length > 0) {
    const node = queue.shift()!;
    visited++;
    for (const next of adj.get(node) ?? []) {
      const deg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }
  if (visited < clueIds.size && relations.length > 0) {
    warnings.push({
      type: 'error',
      category: 'clue_graph',
      message: '단서 관계에 순환 참조가 있습니다',
    });
  }

  // 3. Orphan check (informational — only when some relations exist)
  if (relations.length > 0) {
    const relatedIds = new Set<string>();
    for (const r of relations) {
      relatedIds.add(r.sourceId);
      relatedIds.add(r.targetId);
    }
    const orphans = clues.filter((c) => !relatedIds.has(c.id));
    if (orphans.length > 0 && orphans.length < clues.length) {
      warnings.push({
        type: 'warning',
        category: 'clue_graph',
        message: `${orphans.length}개 단서가 관계에 포함되지 않았습니다`,
      });
    }
  }

  return warnings;
}

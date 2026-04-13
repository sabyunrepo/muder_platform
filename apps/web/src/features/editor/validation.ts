// ---------------------------------------------------------------------------
// Game Design Validation Utility
// ---------------------------------------------------------------------------

export interface DesignWarning {
  type: 'warning' | 'error';
  category: 'phases' | 'clues' | 'characters' | 'modules';
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

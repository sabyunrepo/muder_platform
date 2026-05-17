import type { FlowNodeData } from "../../flowTypes";
import {
  flowNodeToSceneEntryEffects,
  isCompleteSceneEntryEffect,
  makeEmptySceneEntryEffect,
  sceneEntryEffectsToFlowNodePatch,
  type SceneEntryEffectViewModel,
} from "../shared/sceneEntryEffectAdapter";

export type InfoDeliveryTargetMode = "none" | "all_players" | "characters";

export interface InfoDeliveryTargetDraft {
  mode: InfoDeliveryTargetMode;
  characterIds: string[];
}

const EMPTY_TARGET: InfoDeliveryTargetDraft = { mode: "none", characterIds: [] };

export function readInfoDeliveryTarget(
  data: FlowNodeData,
  storyInfoId: string,
): InfoDeliveryTargetDraft {
  const effects = flowNodeToSceneEntryEffects(data).filter((effect) =>
    effect.storyInfoIds.includes(storyInfoId),
  );
  if (effects.some((effect) => effect.recipientType === "all_players")) {
    return { mode: "all_players", characterIds: [] };
  }

  const characterIds = effects
    .filter((effect) => effect.recipientType === "character" && effect.characterId)
    .map((effect) => effect.characterId as string);

  return characterIds.length > 0
    ? { mode: "characters", characterIds: uniqueStrings(characterIds) }
    : EMPTY_TARGET;
}

export function writeInfoDeliveryTarget(
  data: FlowNodeData,
  storyInfoId: string,
  target: InfoDeliveryTargetDraft,
): Pick<FlowNodeData, "onEnter"> {
  const effectsWithoutInfo = flowNodeToSceneEntryEffects(data)
    .map((effect) => ({
      ...effect,
      storyInfoIds: effect.storyInfoIds.filter((id) => id !== storyInfoId),
    }))
    .filter(isCompleteSceneEntryEffect);

  const nextEffects = addInfoTargetEffects(effectsWithoutInfo, storyInfoId, normalizeTarget(target));
  return sceneEntryEffectsToFlowNodePatch(data, nextEffects);
}

export function normalizeTarget(target: InfoDeliveryTargetDraft): InfoDeliveryTargetDraft {
  if (target.mode === "all_players") {
    return { mode: "all_players", characterIds: [] };
  }
  if (target.mode === "characters") {
    const characterIds = uniqueStrings(target.characterIds);
    return characterIds.length > 0 ? { mode: "characters", characterIds } : EMPTY_TARGET;
  }
  return EMPTY_TARGET;
}

export function targetsEqual(a: InfoDeliveryTargetDraft, b: InfoDeliveryTargetDraft): boolean {
  const left = normalizeTarget(a);
  const right = normalizeTarget(b);
  return left.mode === right.mode && left.characterIds.join("\u0000") === right.characterIds.join("\u0000");
}

function addInfoTargetEffects(
  effects: SceneEntryEffectViewModel[],
  storyInfoId: string,
  target: InfoDeliveryTargetDraft,
): SceneEntryEffectViewModel[] {
  if (target.mode === "none") return effects;
  if (target.mode === "all_players") {
    return upsertEffect(effects, "all_players", undefined, storyInfoId);
  }
  return target.characterIds.reduce(
    (next, characterId) => upsertEffect(next, "character", characterId, storyInfoId),
    effects,
  );
}

function upsertEffect(
  effects: SceneEntryEffectViewModel[],
  recipientType: "all_players" | "character",
  characterId: string | undefined,
  storyInfoId: string,
): SceneEntryEffectViewModel[] {
  const index = effects.findIndex((effect) => {
    if (effect.recipientType !== recipientType) return false;
    return recipientType === "all_players" || effect.characterId === characterId;
  });
  if (index < 0) {
    const next = makeEmptySceneEntryEffect(recipientType);
    return [
      ...effects,
      {
        ...next,
        characterId,
        storyInfoIds: [storyInfoId],
      },
    ];
  }

  return effects.map((effect, effectIndex) =>
    effectIndex === index
      ? { ...effect, storyInfoIds: uniqueStrings([...effect.storyInfoIds, storyInfoId]) }
      : effect,
  );
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values)).filter(Boolean);
}

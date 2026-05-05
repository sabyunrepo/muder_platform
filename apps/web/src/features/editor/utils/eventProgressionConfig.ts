import type { PhaseAction } from '../flowTypes';
import { readModuleConfig, writeModuleConfig, type EditorConfig } from './configShape';

export const EVENT_PROGRESSION_MODULE_ID = 'event_progression';

export type TriggerPlacementKind = 'clue' | 'location';

export interface TriggerPlacementConfig extends EditorConfig {
  kind: TriggerPlacementKind;
  entityId: string;
}

export interface EventProgressionTriggerConfig extends EditorConfig {
  id: string;
  label?: string;
  from?: string;
  to?: string;
  password?: string;
  actions?: PhaseAction[];
  placement?: TriggerPlacementConfig;
}

function isRecord(value: unknown): value is EditorConfig {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeAction(value: unknown): PhaseAction | null {
  if (!isRecord(value) || typeof value.type !== 'string' || !value.type.trim()) return null;

  return {
    ...(typeof value.id === 'string' ? { id: value.id } : {}),
    type: value.type.trim(),
    ...(isRecord(value.params) ? { params: value.params } : {}),
  };
}

function normalizePlacement(value: unknown): TriggerPlacementConfig | undefined {
  if (!isRecord(value)) return undefined;
  if (value.kind !== 'clue' && value.kind !== 'location') return undefined;
  const entityId = cleanString(value.entityId);
  if (!entityId) return undefined;
  return { ...value, kind: value.kind, entityId };
}

function normalizeTrigger(value: unknown): EventProgressionTriggerConfig | null {
  if (!isRecord(value)) return null;
  const id = cleanString(value.id);
  if (!id) return null;
  const rest = { ...value };
  delete rest.id;
  delete rest.label;
  delete rest.from;
  delete rest.to;
  delete rest.password;
  delete rest.actions;
  delete rest.placement;

  const actions = Array.isArray(value.actions)
    ? value.actions.map(normalizeAction).filter((action): action is PhaseAction => !!action)
    : undefined;
  const placement = normalizePlacement(value.placement);
  const label = cleanString(value.label);
  const from = cleanString(value.from);
  const to = cleanString(value.to);
  const password = typeof value.password === 'string' ? value.password : undefined;

  return {
    ...rest,
    id,
    ...(label ? { label } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(password !== undefined ? { password } : {}),
    ...(actions ? { actions } : {}),
    ...(placement ? { placement } : {}),
  };
}

function readRawEventProgressionTriggers(configJson: EditorConfig | null | undefined): unknown[] {
  const config = readModuleConfig(configJson, EVENT_PROGRESSION_MODULE_ID);
  return Array.isArray(config.Triggers) ? [...config.Triggers] : [];
}

function rawTriggerMatchesPlacement(value: unknown, placement: TriggerPlacementConfig): boolean {
  if (!isRecord(value)) return false;
  const triggerPlacement = normalizePlacement(value.placement);
  return (
    triggerPlacement?.kind === placement.kind && triggerPlacement.entityId === placement.entityId
  );
}

export function readEventProgressionTriggers(
  configJson: EditorConfig | null | undefined
): EventProgressionTriggerConfig[] {
  return readRawEventProgressionTriggers(configJson)
    .map(normalizeTrigger)
    .filter((trigger): trigger is EventProgressionTriggerConfig => !!trigger);
}

export function writeEventProgressionTriggers(
  configJson: EditorConfig | null | undefined,
  triggers: EventProgressionTriggerConfig[]
): EditorConfig {
  const current = readModuleConfig(configJson, EVENT_PROGRESSION_MODULE_ID);
  const cleanTriggers = triggers
    .map(normalizeTrigger)
    .filter((trigger): trigger is EventProgressionTriggerConfig => !!trigger);

  return writeModuleConfig(configJson, EVENT_PROGRESSION_MODULE_ID, {
    ...current,
    Triggers: cleanTriggers,
  });
}

export function readTriggersForPlacement(
  configJson: EditorConfig | null | undefined,
  placement: TriggerPlacementConfig
): EventProgressionTriggerConfig[] {
  return readEventProgressionTriggers(configJson).filter(
    (trigger) =>
      trigger.placement?.kind === placement.kind &&
      trigger.placement.entityId === placement.entityId
  );
}

export function writeTriggersForPlacement(
  configJson: EditorConfig | null | undefined,
  placement: TriggerPlacementConfig,
  nextPlacementTriggers: EventProgressionTriggerConfig[]
): EditorConfig {
  const otherTriggers = readRawEventProgressionTriggers(configJson).filter(
    (trigger) => !rawTriggerMatchesPlacement(trigger, placement)
  );
  const placedTriggers = nextPlacementTriggers
    .map((trigger) => normalizeTrigger({ ...trigger, placement }))
    .filter((trigger): trigger is EventProgressionTriggerConfig => !!trigger);

  const current = readModuleConfig(configJson, EVENT_PROGRESSION_MODULE_ID);
  return writeModuleConfig(configJson, EVENT_PROGRESSION_MODULE_ID, {
    ...current,
    Triggers: [...otherTriggers, ...placedTriggers],
  });
}

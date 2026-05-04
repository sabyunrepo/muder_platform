import { describe, expect, it } from 'vitest';
import {
  readEventProgressionTriggers,
  readTriggersForPlacement,
  writeTriggersForPlacement,
} from '../eventProgressionConfig';
import { readModuleConfig } from '../configShape';

describe('eventProgressionConfig', () => {
  it('reads only valid event progression triggers from the runtime module', () => {
    const config = {
      modules: {
        event_progression: {
          enabled: true,
          config: {
            Triggers: [
              {
                id: 'trigger-1',
                label: '금고 암호',
                password: '0427',
                placement: { kind: 'clue', entityId: 'clue-1' },
                actions: [{ id: 'action-1', type: 'OPEN_VOTING' }],
              },
              { id: '', actions: [{ type: 'OPEN_VOTING' }] },
              { id: 'trigger-2', placement: { kind: 'bad', entityId: 'clue-1' } },
            ],
          },
        },
      },
    };

    expect(readEventProgressionTriggers(config)).toEqual([
      {
        id: 'trigger-1',
        label: '금고 암호',
        password: '0427',
        placement: { kind: 'clue', entityId: 'clue-1' },
        actions: [{ id: 'action-1', type: 'OPEN_VOTING' }],
      },
      { id: 'trigger-2' },
    ]);
  });

  it('writes triggers for one placement while preserving other runtime settings', () => {
    const base = {
      modules: {
        event_progression: {
          enabled: true,
          config: {
            InitialPhase: 'intro',
            Triggers: [
              {
                id: 'keep-location',
                placement: { kind: 'location', entityId: 'loc-1' },
                actions: [{ type: 'MUTE_CHAT' }],
              },
              {
                id: 'replace-clue',
                placement: { kind: 'clue', entityId: 'clue-1' },
                actions: [{ type: 'OPEN_VOTING' }],
              },
            ],
          },
        },
      },
    };

    const next = writeTriggersForPlacement(base, { kind: 'clue', entityId: 'clue-1' }, [
      {
        id: 'new-clue-trigger',
        label: '암호 입력',
        password: '0427',
        actions: [{ type: 'UNMUTE_CHAT' }],
      },
    ]);

    expect(readTriggersForPlacement(next, { kind: 'clue', entityId: 'clue-1' })).toEqual([
      {
        id: 'new-clue-trigger',
        label: '암호 입력',
        password: '0427',
        placement: { kind: 'clue', entityId: 'clue-1' },
        actions: [{ type: 'UNMUTE_CHAT' }],
      },
    ]);
    expect(readModuleConfig(next, 'event_progression')).toMatchObject({
      InitialPhase: 'intro',
      Triggers: [
        {
          id: 'keep-location',
          placement: { kind: 'location', entityId: 'loc-1' },
          actions: [{ type: 'MUTE_CHAT' }],
        },
        {
          id: 'new-clue-trigger',
          placement: { kind: 'clue', entityId: 'clue-1' },
          actions: [{ type: 'UNMUTE_CHAT' }],
        },
      ],
    });
  });

  it('preserves malformed and future triggers when writing one placement', () => {
    const malformedTrigger = { placement: { kind: 'location', entityId: 'loc-1' }, custom: true };
    const futureTrigger = {
      id: 'future-trigger',
      placement: { kind: 'room', entityId: 'room-1' },
      customPayload: { mode: 'future' },
    };
    const next = writeTriggersForPlacement(
      {
        modules: {
          event_progression: {
            enabled: true,
            config: {
              Triggers: [
                malformedTrigger,
                futureTrigger,
                {
                  id: 'old-clue-trigger',
                  placement: { kind: 'clue', entityId: 'clue-1' },
                  actions: [{ type: 'OPEN_VOTING' }],
                },
              ],
            },
          },
        },
      },
      { kind: 'clue', entityId: 'clue-1' },
      [{ id: 'new-clue-trigger', actions: [{ type: 'UNMUTE_CHAT' }] }]
    );

    expect(readModuleConfig(next, 'event_progression')).toMatchObject({
      Triggers: [
        malformedTrigger,
        futureTrigger,
        {
          id: 'new-clue-trigger',
          placement: { kind: 'clue', entityId: 'clue-1' },
          actions: [{ type: 'UNMUTE_CHAT' }],
        },
      ],
    });
  });
});

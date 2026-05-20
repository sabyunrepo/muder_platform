import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { voiceApi } from '@/services/voiceApi';
import { useVoiceStore } from '@/stores/voiceStore';
import { RoomVoicePanel } from '../RoomVoicePanel';

const {
  liveKitRoomProps,
  microphoneEnabledMock,
  participantsMock,
  silentParticipantsMock,
  localParticipantState,
} = vi.hoisted(() => ({
  liveKitRoomProps: { current: null as null | {
    onConnected?: () => void;
    onDisconnected?: () => void;
    onError?: (error: Error) => void;
  } },
  microphoneEnabledMock: vi.fn(),
  participantsMock: [
    { identity: 'local-user', sid: 'local-sid', audioLevel: 0.02, isMicrophoneEnabled: true },
    {
      identity: 'remote-user',
      sid: 'remote-sid',
      audioLevel: 0.04,
      audioTrackPublications: new Map([['audio', { isMuted: false }]]),
    },
  ],
  silentParticipantsMock: [] as Array<{
    identity: string;
    sid: string;
    audioLevel: number;
    isMicrophoneEnabled?: boolean;
    audioTrackPublications?: Map<string, { isMuted: boolean }>;
  }>,
  localParticipantState: { audioLevel: 0.02 },
}));

vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: (props: {
    children: ReactNode;
    onConnected?: () => void;
    onDisconnected?: () => void;
    onError?: (error: Error) => void;
  }) => {
    liveKitRoomProps.current = props;
    return <div data-testid="livekit-room">{props.children}</div>;
  },
  RoomAudioRenderer: ({ muted }: { muted?: boolean }) => (
    <div data-muted={muted ? 'true' : 'false'} data-testid="room-audio-renderer" />
  ),
  useParticipants: () => (silentParticipantsMock.length > 0 ? silentParticipantsMock : participantsMock),
  useLocalParticipant: () => ({
    localParticipant: {
      identity: 'local-user',
      sid: 'local-sid',
      audioLevel: localParticipantState.audioLevel,
      isMicrophoneEnabled: true,
      setMicrophoneEnabled: microphoneEnabledMock,
    },
  }),
}));

vi.mock('@/services/voiceApi', () => ({
  voiceApi: {
    getTokenForTarget: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  liveKitRoomProps.current = null;
  silentParticipantsMock.length = 0;
  localParticipantState.audioLevel = 0.02;
  useVoiceStore.getState().reset();
});

describe('RoomVoicePanel', () => {
  it('wires LiveKit callbacks to reconnectable voice state', async () => {
    vi.mocked(voiceApi.getTokenForTarget).mockResolvedValue({
      token: 'token-1',
      room_name: 'room-room-1-main',
      livekit_url: 'ws://livekit',
    });

    render(<RoomVoicePanel roomId="room-1" isActive />);

    fireEvent.click(screen.getByRole('button', { name: /입장/ }));

    await screen.findByTestId('livekit-room');
    expect(screen.getByTestId('room-audio-renderer')).toHaveAttribute('data-muted', 'false');
    expect(screen.queryByText('2명이 음성 채팅에 연결되어 있습니다.')).not.toBeInTheDocument();

    act(() => {
      liveKitRoomProps.current?.onConnected?.();
    });

    expect(await screen.findByText('2명이 음성 채팅에 연결되어 있습니다.')).toBeInTheDocument();

    act(() => {
      liveKitRoomProps.current?.onDisconnected?.();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('livekit-room')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /입장/ })).toBeEnabled();
  });

  it('uses LiveKit participant controls for microphone and speaker state', async () => {
    vi.mocked(voiceApi.getTokenForTarget).mockResolvedValue({
      token: 'token-1',
      room_name: 'room-room-1-main',
      livekit_url: 'ws://livekit',
    });

    render(<RoomVoicePanel roomId="room-1" isActive />);

    fireEvent.click(screen.getByRole('button', { name: /입장/ }));
    await screen.findByTestId('livekit-room');

    act(() => {
      liveKitRoomProps.current?.onConnected?.();
    });

    fireEvent.click(await screen.findByRole('button', { name: /마이크 끄기/ }));

    await waitFor(() => {
      expect(microphoneEnabledMock).toHaveBeenCalledWith(false);
    });
    expect(await screen.findByRole('button', { name: /마이크 켜기/ })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /스피커 끄기/ }));

    expect(screen.getByTestId('room-audio-renderer')).toHaveAttribute('data-muted', 'true');
  });

  it('renders compact header controls and a speaking overlay for the communication hub', async () => {
    vi.mocked(voiceApi.getTokenForTarget).mockResolvedValue({
      token: 'token-1',
      room_name: 'room-room-1-main',
      livekit_url: 'ws://livekit',
    });

    render(
      <RoomVoicePanel
        roomId="room-1"
        isActive
        variant="inline"
        playerNameById={
          new Map([
            ['local-user', '나참가자'],
            ['remote-user', '원격참가자'],
          ])
        }
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /입장/ }));
    await screen.findByTestId('livekit-room');

    act(() => {
      liveKitRoomProps.current?.onConnected?.();
    });

    expect(await screen.findByText('말하는 참가자')).toBeInTheDocument();
    expect(screen.getByText('나참가자')).toBeInTheDocument();
    expect(screen.getByText('원격참가자')).toBeInTheDocument();
    expect(useVoiceStore.getState().participantVoiceStates).toMatchObject({
      'local-user': { isSpeaking: true, isMuted: false },
      'remote-user': { isSpeaking: true, isMuted: false },
    });
    expect(screen.getByRole('button', { name: /마이크 끄기/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /스피커 끄기/ })).toBeEnabled();
  });

  it('does not clear synced participant voice state during LiveKit activity updates', async () => {
    vi.mocked(voiceApi.getTokenForTarget).mockResolvedValue({
      token: 'token-1',
      room_name: 'room-room-1-main',
      livekit_url: 'ws://livekit',
    });
    const clearVoiceStatesSpy = vi.spyOn(
      useVoiceStore.getState(),
      'clearParticipantVoiceStates'
    );

    const { rerender } = render(<RoomVoicePanel roomId="room-1" isActive variant="inline" />);

    fireEvent.click(screen.getByRole('button', { name: /입장/ }));
    await screen.findByTestId('livekit-room');

    act(() => {
      liveKitRoomProps.current?.onConnected?.();
    });

    expect(useVoiceStore.getState().participantVoiceStates).not.toEqual({});
    clearVoiceStatesSpy.mockClear();

    localParticipantState.audioLevel = 0.04;
    rerender(<RoomVoicePanel roomId="room-1" isActive variant="inline" />);

    expect(clearVoiceStatesSpy).not.toHaveBeenCalled();
    expect(useVoiceStore.getState().participantVoiceStates).not.toEqual({});
  });

  it('uses a safe display label when LiveKit participant names cannot be mapped', async () => {
    vi.mocked(voiceApi.getTokenForTarget).mockResolvedValue({
      token: 'token-1',
      room_name: 'room-room-1-main',
      livekit_url: 'ws://livekit',
    });

    render(<RoomVoicePanel roomId="room-1" isActive variant="inline" />);

    fireEvent.click(screen.getByRole('button', { name: /입장/ }));
    await screen.findByTestId('livekit-room');

    act(() => {
      liveKitRoomProps.current?.onConnected?.();
    });

    expect(await screen.findByText('말하는 참가자')).toBeInTheDocument();
    expect(screen.getAllByText(/음성 참가자/).length).toBeGreaterThan(0);
    expect(screen.queryByText('local-user')).not.toBeInTheDocument();
    expect(screen.queryByText('remote-user')).not.toBeInTheDocument();
  });

  it('hides the speaking overlay when LiveKit reports no active speakers', async () => {
    localParticipantState.audioLevel = 0;
    silentParticipantsMock.push({
      identity: 'remote-user',
      sid: 'remote-sid',
      audioLevel: 0,
      audioTrackPublications: new Map([['audio', { isMuted: false }]]),
    });
    vi.mocked(voiceApi.getTokenForTarget).mockResolvedValue({
      token: 'token-1',
      room_name: 'room-room-1-main',
      livekit_url: 'ws://livekit',
    });

    render(<RoomVoicePanel roomId="room-1" isActive variant="inline" />);

    fireEvent.click(screen.getByRole('button', { name: /입장/ }));
    await screen.findByTestId('livekit-room');

    act(() => {
      liveKitRoomProps.current?.onConnected?.();
    });

    expect(screen.queryByText('말하는 참가자')).not.toBeInTheDocument();
  });

  it('clears participant voice state when leaving voice chat', async () => {
    vi.mocked(voiceApi.getTokenForTarget).mockResolvedValue({
      token: 'token-1',
      room_name: 'room-room-1-main',
      livekit_url: 'ws://livekit',
    });

    render(<RoomVoicePanel roomId="room-1" isActive variant="inline" />);

    fireEvent.click(screen.getByRole('button', { name: /입장/ }));
    await screen.findByTestId('livekit-room');

    act(() => {
      liveKitRoomProps.current?.onConnected?.();
    });

    expect(useVoiceStore.getState().participantVoiceStates).not.toEqual({});

    fireEvent.click(await screen.findByRole('button', { name: /음성 채팅 나가기/ }));

    expect(useVoiceStore.getState().participantVoiceStates).toEqual({});
  });
});

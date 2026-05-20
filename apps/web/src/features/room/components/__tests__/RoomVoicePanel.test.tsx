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
} = vi.hoisted(() => ({
  liveKitRoomProps: { current: null as null | {
    onConnected?: () => void;
    onDisconnected?: () => void;
    onError?: (error: Error) => void;
  } },
  microphoneEnabledMock: vi.fn(),
  participantsMock: [
    { identity: 'local-user' },
    { identity: 'remote-user' },
  ],
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
  useParticipants: () => participantsMock,
  useLocalParticipant: () => ({
    localParticipant: {
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
});

import { useCallback, useEffect, useMemo } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
} from '@livekit/components-react';
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react';

import { useVoiceConnection } from '@/hooks/useVoiceConnection';
import { useVoiceStore, selectIsMuted, selectIsSpeakerMuted, selectVoiceConnectionState } from '@/stores/voiceStore';
import { Button, Panel } from '@/shared/components/ui';

interface RoomVoicePanelProps {
  roomId: string;
  isActive: boolean;
  variant?: 'panel' | 'inline';
  playerNameById?: Map<string, string>;
}

interface VoiceParticipantLike {
  identity?: string;
  sid?: string;
  name?: string;
  audioLevel?: number;
  isSpeaking?: boolean;
  isMicrophoneEnabled?: boolean;
  setMicrophoneEnabled?: (enabled: boolean) => Promise<void>;
  audioTrackPublications?: Map<string, { isMuted?: boolean }>;
}

const stateLabel = {
  disconnected: '연결 안 됨',
  connecting: '연결 중',
  connected: '연결됨',
  error: '연결 실패',
} as const;

export function RoomVoicePanel({
  roomId,
  isActive,
  variant = 'panel',
  playerNameById,
}: RoomVoicePanelProps) {
  const connectionState = useVoiceStore(selectVoiceConnectionState);
  const isMuted = useVoiceStore(selectIsMuted);
  const isSpeakerMuted = useVoiceStore(selectIsSpeakerMuted);
  const resetVoice = useVoiceStore((state) => state.reset);
  const clearParticipantVoiceStates = useVoiceStore((state) => state.clearParticipantVoiceStates);
  const {
    connectionDetails,
    connect,
    disconnect,
    handleConnected,
    handleDisconnected,
    handleError,
  } =
    useVoiceConnection({
      roomId,
      roomType: 'main',
      autoConnect: false,
    });

  useEffect(() => {
    if (isActive) return;
    void disconnect();
    clearParticipantVoiceStates();
    resetVoice();
  }, [clearParticipantVoiceStates, disconnect, isActive, resetVoice]);

  useEffect(() => {
    return () => {
      void disconnect();
      clearParticipantVoiceStates();
      resetVoice();
    };
  }, [clearParticipantVoiceStates, disconnect, resetVoice]);

  const canDisconnect = connectionState === 'connected' || connectionState === 'connecting';
  const helperText = useMemo(() => {
    if (!isActive) return '게임 시작 또는 방 나가기 중에는 음성 연결을 정리합니다.';
    if (connectionState === 'error') return '음성 서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.';
    if (connectionState === 'connected') return '음성 채팅에 연결되어 있습니다.';
    return '대기방 참가자만 음성 채팅에 들어갈 수 있습니다.';
  }, [connectionState, isActive]);
  const handleDisconnect = useCallback(() => {
    clearParticipantVoiceStates();
    void disconnect();
  }, [clearParticipantVoiceStates, disconnect]);

  const content = (
    <div
      className={
        variant === 'inline'
          ? 'flex min-w-0 flex-col gap-2 sm:min-w-[220px]'
          : 'flex min-w-0 flex-col gap-3'
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--mmp-color-ink)]">
            <Mic className="h-4 w-4 shrink-0" />
            <span className="truncate">음성 채팅</span>
          </h2>
          <p className="mt-1 text-xs text-[var(--mmp-color-steel)]">{stateLabel[connectionState]}</p>
        </div>
        {canDisconnect ? (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<PhoneOff className="h-4 w-4" />}
            onClick={handleDisconnect}
            aria-label="음성 채팅 나가기"
          >
            나가기
          </Button>
        ) : (
          <Button
            size="sm"
            leftIcon={<Phone className="h-4 w-4" />}
            onClick={() => void connect()}
            isLoading={connectionState === 'connecting'}
            disabled={!isActive}
          >
            입장
          </Button>
        )}
      </div>

      <p
        className={`break-words text-sm ${
          connectionState === 'error'
            ? 'font-medium text-[var(--mmp-color-error)]'
            : 'text-[var(--mmp-color-steel)]'
        }`}
      >
        {helperText}
      </p>

      {connectionDetails ? (
        <LiveKitRoom
          serverUrl={connectionDetails.serverUrl}
          token={connectionDetails.token}
          connect
          audio
          video={false}
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onError={handleError}
          className="contents"
        >
          <RoomAudioRenderer muted={isSpeakerMuted} />
          <LiveKitVoiceControls />
          <LiveKitSpeakingOverlay playerNameById={playerNameById} />
        </LiveKitRoom>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={isMuted ? 'danger' : 'secondary'}
            leftIcon={isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            disabled
          >
            {isMuted ? '마이크 켜기' : '마이크 끄기'}
          </Button>
          <Button
            size="sm"
            variant={isSpeakerMuted ? 'danger' : 'secondary'}
            leftIcon={isSpeakerMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            disabled
          >
            {isSpeakerMuted ? '스피커 켜기' : '스피커 끄기'}
          </Button>
        </div>
      )}
    </div>
  );

  if (variant === 'inline') {
    return content;
  }

  return <Panel className="flex flex-col gap-3">{content}</Panel>;
}

function LiveKitVoiceControls() {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant() as { localParticipant: VoiceParticipantLike };
  const connectionState = useVoiceStore(selectVoiceConnectionState);
  const isMuted = useVoiceStore(selectIsMuted);
  const isSpeakerMuted = useVoiceStore(selectIsSpeakerMuted);
  const toggleStoreMute = useVoiceStore((state) => state.toggleMute);
  const toggleStoreSpeakerMute = useVoiceStore((state) => state.toggleSpeakerMute);
  const setConnectionState = useVoiceStore((state) => state.setConnectionState);

  const handleToggleMute = async () => {
    const nextMuted = !isMuted;
    try {
      await localParticipant.setMicrophoneEnabled?.(!nextMuted);
      toggleStoreMute();
    } catch {
      setConnectionState('error');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {connectionState === 'connected' && (
        <p className="text-xs text-[var(--mmp-color-steel)]">
          {participants.length}명이 음성 채팅에 연결되어 있습니다.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={isMuted ? 'danger' : 'secondary'}
          leftIcon={isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          onClick={() => void handleToggleMute()}
          disabled={connectionState !== 'connected'}
        >
          {isMuted ? '마이크 켜기' : '마이크 끄기'}
        </Button>
        <Button
          size="sm"
          variant={isSpeakerMuted ? 'danger' : 'secondary'}
          leftIcon={isSpeakerMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          onClick={toggleStoreSpeakerMute}
          disabled={connectionState !== 'connected'}
        >
          {isSpeakerMuted ? '스피커 켜기' : '스피커 끄기'}
        </Button>
      </div>
    </div>
  );
}

function LiveKitSpeakingOverlay({ playerNameById }: { playerNameById?: Map<string, string> }) {
  const participants = useParticipants() as VoiceParticipantLike[];
  const { localParticipant } = useLocalParticipant() as { localParticipant?: VoiceParticipantLike };
  const setParticipantVoiceStates = useVoiceStore((state) => state.setParticipantVoiceStates);

  const participantVoiceStates = useMemo(() => {
    const participantByIdentity = new Map<string, VoiceParticipantLike>();
    const voiceStates: Record<string, { isSpeaking: boolean; isMuted: boolean }> = {};

    for (const participant of [localParticipant, ...participants]) {
      const identity = participant?.identity ?? participant?.sid;
      if (!identity) continue;
      participantByIdentity.set(identity, participant);
    }

    for (const participant of participantByIdentity.values()) {
      const identity = participant.identity ?? participant.sid;
      if (!identity) continue;
      const publications = Array.from(participant.audioTrackPublications?.values() ?? []);

      voiceStates[identity] = {
        isSpeaking: Boolean(participant.isSpeaking) || (participant.audioLevel ?? 0) > 0.01,
        isMuted:
          participant.isMicrophoneEnabled === false ||
          (publications.length > 0 && publications.every((publication) => publication.isMuted)),
      };
    }

    return voiceStates;
  }, [localParticipant, participants]);

  useEffect(() => {
    setParticipantVoiceStates(participantVoiceStates);
  }, [participantVoiceStates, setParticipantVoiceStates]);

  useEffect(() => {
    return () => {
      useVoiceStore.getState().clearParticipantVoiceStates();
    };
  }, []);

  const speakingParticipants = useMemo(() => {
    const participantByIdentity = new Map<string, VoiceParticipantLike>();

    for (const participant of [localParticipant, ...participants]) {
      const identity = participant?.identity ?? participant?.sid;
      if (!identity) continue;
      participantByIdentity.set(identity, participant);
    }

    return Array.from(participantByIdentity.values()).filter((participant) => {
      const identity = participant.identity ?? participant.sid;
      return identity ? participantVoiceStates[identity]?.isSpeaking : false;
    });
  }, [localParticipant, participantVoiceStates, participants]);

  if (speakingParticipants.length === 0) {
    return null;
  }

  return (
    <div
      aria-label="말하는 참가자"
      className="rounded-md border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-muted)]/50 p-2"
    >
      <p className="text-xs font-semibold text-[var(--mmp-color-ink)]">말하는 참가자</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {speakingParticipants.map((participant) => {
          const identity = participant.identity ?? participant.sid ?? 'unknown';
          const name = playerNameById?.get(identity) ?? participant.name ?? '음성 참가자';
          const isMuted = participantVoiceStates[identity]?.isMuted ?? false;

          return (
            <span
              key={identity}
              className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full bg-[var(--mmp-color-surface)] px-2 py-1 text-xs font-medium text-[var(--mmp-color-charcoal)]"
            >
              <Mic className="h-3 w-3 shrink-0 text-[var(--mmp-color-primary)]" />
              <span className="min-w-0 truncate">{name}</span>
              {isMuted && <span className="text-[10px] text-[var(--mmp-color-steel)]">음소거</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

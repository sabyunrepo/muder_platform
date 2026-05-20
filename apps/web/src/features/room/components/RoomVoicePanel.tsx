import { useEffect, useMemo } from 'react';
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
}

const stateLabel = {
  disconnected: '연결 안 됨',
  connecting: '연결 중',
  connected: '연결됨',
  error: '연결 실패',
} as const;

export function RoomVoicePanel({ roomId, isActive }: RoomVoicePanelProps) {
  const connectionState = useVoiceStore(selectVoiceConnectionState);
  const isMuted = useVoiceStore(selectIsMuted);
  const isSpeakerMuted = useVoiceStore(selectIsSpeakerMuted);
  const resetVoice = useVoiceStore((state) => state.reset);
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
    resetVoice();
  }, [disconnect, isActive, resetVoice]);

  useEffect(() => {
    return () => {
      void disconnect();
      resetVoice();
    };
  }, [disconnect, resetVoice]);

  const canDisconnect = connectionState === 'connected' || connectionState === 'connecting';
  const helperText = useMemo(() => {
    if (!isActive) return '게임 시작 또는 방 나가기 중에는 음성 연결을 정리합니다.';
    if (connectionState === 'error') return '음성 서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.';
    if (connectionState === 'connected') return '음성 채팅에 연결되어 있습니다.';
    return '대기방 참가자만 음성 채팅에 들어갈 수 있습니다.';
  }, [connectionState, isActive]);

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--mmp-color-ink)]">
            <Mic className="h-4 w-4" />
            음성 채팅
          </h2>
          <p className="mt-1 text-xs text-[var(--mmp-color-steel)]">{stateLabel[connectionState]}</p>
        </div>
        {canDisconnect ? (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<PhoneOff className="h-4 w-4" />}
            onClick={() => void disconnect()}
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
        className={`text-sm ${
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
    </Panel>
  );
}

function LiveKitVoiceControls() {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const connectionState = useVoiceStore(selectVoiceConnectionState);
  const isMuted = useVoiceStore(selectIsMuted);
  const isSpeakerMuted = useVoiceStore(selectIsSpeakerMuted);
  const toggleStoreMute = useVoiceStore((state) => state.toggleMute);
  const toggleStoreSpeakerMute = useVoiceStore((state) => state.toggleSpeakerMute);
  const setConnectionState = useVoiceStore((state) => state.setConnectionState);

  const handleToggleMute = async () => {
    const nextMuted = !isMuted;
    try {
      await localParticipant.setMicrophoneEnabled(!nextMuted);
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

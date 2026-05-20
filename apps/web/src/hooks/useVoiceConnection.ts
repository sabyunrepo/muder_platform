import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalParticipant, RemoteParticipant } from "livekit-client";

import { voiceApi, type TokenResponse } from "@/services/voiceApi";
import { useVoiceStore } from "@/stores/voiceStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoiceParticipant = LocalParticipant | RemoteParticipant;

export interface VoiceConnectionDetails {
  token: string;
  roomName: string;
  serverUrl: string;
}

interface UseVoiceConnectionOptions {
  sessionId?: string;
  roomId?: string;
  roomType: "main" | "whisper";
  roomName?: string;
  /** mount 시 자동 연결 여부 (기본값: true) */
  autoConnect?: boolean;
}

interface UseVoiceConnectionReturn {
  connectionDetails: VoiceConnectionDetails | null;
  participants: RemoteParticipant[];
  localParticipant: LocalParticipant | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleSpeakerMute: () => void;
  handleConnected: () => void;
  handleDisconnected: () => void;
  handleError: (error: Error) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVoiceConnection(
  options: UseVoiceConnectionOptions,
): UseVoiceConnectionReturn {
  const { sessionId, roomId, roomType, roomName, autoConnect = true } = options;

  const setConnectionState = useVoiceStore((s) => s.setConnectionState);
  const setCurrentChannel = useVoiceStore((s) => s.setCurrentChannel);

  const connectionGenerationRef = useRef(0);
  const activeConnectionRef = useRef(false);
  const pendingRoomNameRef = useRef<string | null>(null);
  const [connectionDetails, setConnectionDetails] =
    useState<VoiceConnectionDetails | null>(null);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [localParticipant, setLocalParticipant] =
    useState<LocalParticipant | null>(null);

  // Keep options accessible in callbacks without re-creating them
  const optsRef = useRef(options);
  optsRef.current = options;

  const connect = useCallback(async () => {
    const generation = connectionGenerationRef.current + 1;
    connectionGenerationRef.current = generation;

    activeConnectionRef.current = false;
    setConnectionDetails(null);
    pendingRoomNameRef.current = null;
    setConnectionState("connecting");

    try {
      const { sessionId: sid, roomId: rid, roomType: rt, roomName: rn } = optsRef.current;
      const tokenData = await voiceApi.getTokenForTarget({
        sessionId: sid,
        roomId: rid,
        roomType: rt,
        roomName: rn,
      });

      if (connectionGenerationRef.current !== generation) return;

      pendingRoomNameRef.current = tokenData.room_name;
      activeConnectionRef.current = true;
      setConnectionDetails(toConnectionDetails(tokenData));
    } catch {
      if (connectionGenerationRef.current === generation) {
        setConnectionState("error");
      }
    }
  }, [setConnectionState]);

  const disconnect = useCallback(async () => {
    connectionGenerationRef.current += 1;
    activeConnectionRef.current = false;
    pendingRoomNameRef.current = null;
    setConnectionDetails(null);
    setConnectionState("disconnected");
    setCurrentChannel(null);
    setParticipants([]);
    setLocalParticipant(null);
  }, [setConnectionState, setCurrentChannel]);

  const toggleMute = useCallback(async () => {
    // Media control is handled by components rendered under LiveKitRoom.
  }, []);

  const toggleSpeakerMute = useCallback(() => {
    // Speaker mute is handled by RoomAudioRenderer in the room component tree.
  }, []);

  const handleConnected = useCallback(() => {
    if (!activeConnectionRef.current) return;
    setConnectionState("connected");
    setCurrentChannel(pendingRoomNameRef.current);
  }, [setConnectionState, setCurrentChannel]);

  const handleDisconnected = useCallback(() => {
    if (!activeConnectionRef.current) return;
    activeConnectionRef.current = false;
    pendingRoomNameRef.current = null;
    setConnectionDetails(null);
    setConnectionState("disconnected");
    setCurrentChannel(null);
    setParticipants([]);
    setLocalParticipant(null);
  }, [setConnectionState, setCurrentChannel]);

  const handleError = useCallback(
    (_error: Error) => {
      if (!activeConnectionRef.current) return;
      activeConnectionRef.current = false;
      setConnectionDetails(null);
      pendingRoomNameRef.current = null;
      setConnectionState("error");
      setCurrentChannel(null);
    },
    [setConnectionState, setCurrentChannel],
  );

  useEffect(() => {
    if (!autoConnect) return;
    void connect();

    return () => {
      void disconnect();
    };
  }, [autoConnect, connect, disconnect, sessionId, roomId, roomType, roomName]);

  return {
    connectionDetails,
    participants,
    localParticipant,
    connect,
    disconnect,
    toggleMute,
    toggleSpeakerMute,
    handleConnected,
    handleDisconnected,
    handleError,
  };
}

function toConnectionDetails(tokenData: TokenResponse): VoiceConnectionDetails {
  return {
    token: tokenData.token,
    roomName: tokenData.room_name,
    serverUrl: tokenData.livekit_url,
  };
}

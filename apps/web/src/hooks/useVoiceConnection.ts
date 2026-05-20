import { useCallback, useEffect, useRef, useState } from "react";
import {
  LocalParticipant,
  RemoteParticipant,
  Room,
  RoomEvent,
} from "livekit-client";

import { voiceApi } from "@/services/voiceApi";
import { useVoiceStore } from "@/stores/voiceStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoiceParticipant = LocalParticipant | RemoteParticipant;

interface UseVoiceConnectionOptions {
  sessionId?: string;
  roomId?: string;
  roomType: "main" | "whisper";
  roomName?: string;
  /** mount 시 자동 연결 여부 (기본값: true) */
  autoConnect?: boolean;
}

interface UseVoiceConnectionReturn {
  room: Room | null;
  participants: RemoteParticipant[];
  localParticipant: LocalParticipant | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleSpeakerMute: () => void;
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
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isSpeakerMuted = useVoiceStore((s) => s.isSpeakerMuted);
  const storeToggleMute = useVoiceStore((s) => s.toggleMute);
  const storeToggleSpeakerMute = useVoiceStore((s) => s.toggleSpeakerMute);

  const roomRef = useRef<Room | null>(null);
  const connectionGenerationRef = useRef(0);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [localParticipant, setLocalParticipant] =
    useState<LocalParticipant | null>(null);

  // Keep options accessible in callbacks without re-creating them
  const optsRef = useRef(options);
  optsRef.current = options;

  // Keep latest mute state accessible in callbacks
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const isSpeakerMutedRef = useRef(isSpeakerMuted);
  isSpeakerMutedRef.current = isSpeakerMuted;

  const syncParticipants = (room: Room) => {
    setParticipants(Array.from(room.remoteParticipants.values()));
    setLocalParticipant(room.localParticipant);
  };

  const connect = useCallback(async () => {
    const generation = connectionGenerationRef.current + 1;
    connectionGenerationRef.current = generation;

    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }

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

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.Connected, () => {
        if (connectionGenerationRef.current !== generation) return;
        setConnectionState("connected");
        setCurrentChannel(tokenData.room_name);
        syncParticipants(room);
      });

      room.on(RoomEvent.Disconnected, () => {
        if (connectionGenerationRef.current !== generation) return;
        setConnectionState("disconnected");
        setCurrentChannel(null);
        setParticipants([]);
        setLocalParticipant(null);
      });

      room.on(RoomEvent.Reconnecting, () => {
        if (connectionGenerationRef.current !== generation) return;
        setConnectionState("connecting");
      });

      room.on(RoomEvent.ParticipantConnected, () => {
        if (connectionGenerationRef.current !== generation) return;
        syncParticipants(room);
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        if (connectionGenerationRef.current !== generation) return;
        syncParticipants(room);
      });

      await room.connect(tokenData.livekit_url, tokenData.token);

      if (connectionGenerationRef.current !== generation) {
        void room.disconnect();
        if (roomRef.current === room) {
          roomRef.current = null;
        }
      }
    } catch {
      if (connectionGenerationRef.current === generation) {
        setConnectionState("error");
      }
    }
  }, [setConnectionState, setCurrentChannel]);

  const disconnect = useCallback(async () => {
    connectionGenerationRef.current += 1;
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setConnectionState("disconnected");
    setCurrentChannel(null);
    setParticipants([]);
    setLocalParticipant(null);
  }, [setConnectionState, setCurrentChannel]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const nextMuted = !isMutedRef.current;
    try {
      await room.localParticipant.setMicrophoneEnabled(!nextMuted);
      storeToggleMute();
    } catch {
      setConnectionState("error");
    }
  }, [setConnectionState, storeToggleMute]);

  const toggleSpeakerMute = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const nextSpeakerMuted = !isSpeakerMutedRef.current;
    for (const participant of room.remoteParticipants.values()) {
      for (const pub of participant.audioTrackPublications.values()) {
        if (pub.audioTrack) {
          pub.audioTrack.setMuted(nextSpeakerMuted);
        }
      }
    }
    storeToggleSpeakerMute();
  }, [storeToggleSpeakerMute]);

  useEffect(() => {
    if (!autoConnect) return;

    let stale = false;

    const run = async () => {
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }

      setConnectionState("connecting");

      try {
        const { sessionId: sid, roomId: rid, roomType: rt, roomName: rn } = optsRef.current;
        const tokenData = await voiceApi.getTokenForTarget({
          sessionId: sid,
          roomId: rid,
          roomType: rt,
          roomName: rn,
        });

        if (stale) return;

        const room = new Room();
        roomRef.current = room;

        room.on(RoomEvent.Connected, () => {
          if (stale) return;
          setConnectionState("connected");
          setCurrentChannel(tokenData.room_name);
          syncParticipants(room);
        });

        room.on(RoomEvent.Disconnected, () => {
          setConnectionState("disconnected");
          setCurrentChannel(null);
          setParticipants([]);
          setLocalParticipant(null);
        });

        room.on(RoomEvent.Reconnecting, () => {
          setConnectionState("connecting");
        });

        room.on(RoomEvent.ParticipantConnected, () => {
          syncParticipants(room);
        });

        room.on(RoomEvent.ParticipantDisconnected, () => {
          syncParticipants(room);
        });

        await room.connect(tokenData.livekit_url, tokenData.token);

        if (stale) {
          void room.disconnect();
          roomRef.current = null;
        }
      } catch {
        if (!stale) {
          setConnectionState("error");
        }
      }
    };

    void run();

    return () => {
      stale = true;
      if (roomRef.current) {
        void roomRef.current.disconnect();
        roomRef.current = null;
      }
      setConnectionState("disconnected");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, sessionId, roomId, roomType, roomName]);

  return {
    room: roomRef.current,
    participants,
    localParticipant,
    connect,
    disconnect,
    toggleMute,
    toggleSpeakerMute,
  };
}

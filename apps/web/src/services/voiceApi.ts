import { api } from "@/services/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenResponse {
  token: string;
  room_name: string;
  livekit_url: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const voiceApi = {
  getToken: (sessionId: string, roomType: string, roomName?: string) =>
    api.post<TokenResponse>("/v1/voice/token", {
      session_id: sessionId,
      room_type: roomType,
      room_name: roomName,
    }),
};

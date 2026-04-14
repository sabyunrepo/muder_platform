import { create } from "zustand";
import { WsClient, WsClientState } from "@mmp/ws-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConnectionState {
  gameClient: WsClient | null;
  socialClient: WsClient | null;
  gameState: WsClientState;
  socialState: WsClientState;
  sessionId: string | null;
}

export interface ConnectionActions {
  connectGame: (sessionId: string, token: string) => void;
  connectSocial: (token: string) => void;
  disconnectGame: () => void;
  disconnectSocial: () => void;
  disconnectAll: () => void;
  setGameState: (state: WsClientState) => void;
  setSocialState: (state: WsClientState) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWsBase(): string {
  const { protocol, host } = window.location;
  const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${host}`;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useConnectionStore = create<ConnectionState & ConnectionActions>()(
  (set, get) => ({
    gameClient: null,
    socialClient: null,
    gameState: WsClientState.IDLE,
    socialState: WsClientState.IDLE,
    sessionId: null,

    connectGame: (sessionId, token) => {
      const { gameClient } = get();
      if (gameClient) {
        gameClient.disconnect();
      }

      const wsBase = buildWsBase();
      const client = new WsClient({
        url: `${wsBase}/ws/game?token=${encodeURIComponent(token)}`,
        token,
      });

      client.onStateChange((state) => {
        get().setGameState(state);
      });

      set({ gameClient: client, sessionId });
      client.connect();
    },

    connectSocial: (token) => {
      const { socialClient } = get();
      if (socialClient) {
        socialClient.disconnect();
      }

      const wsBase = buildWsBase();
      const client = new WsClient({
        url: `${wsBase}/ws/social?token=${encodeURIComponent(token)}`,
        token,
      });

      client.onStateChange((state) => {
        get().setSocialState(state);
      });

      set({ socialClient: client });
      client.connect();
    },

    disconnectGame: () => {
      const { gameClient } = get();
      if (gameClient) {
        gameClient.disconnect();
      }
      set({ gameClient: null, sessionId: null, gameState: WsClientState.DISCONNECTED });
    },

    disconnectSocial: () => {
      const { socialClient } = get();
      if (socialClient) {
        socialClient.disconnect();
      }
      set({ socialClient: null, socialState: WsClientState.DISCONNECTED });
    },

    disconnectAll: () => {
      const { gameClient, socialClient } = get();
      if (gameClient) {
        gameClient.disconnect();
      }
      if (socialClient) {
        socialClient.disconnect();
      }
      set({
        gameClient: null,
        socialClient: null,
        sessionId: null,
        gameState: WsClientState.DISCONNECTED,
        socialState: WsClientState.DISCONNECTED,
      });
    },

    setGameState: (state) => {
      set({ gameState: state });
    },

    setSocialState: (state) => {
      set({ socialState: state });
    },
  }),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectGameState = (s: ConnectionState) => s.gameState;
export const selectSocialState = (s: ConnectionState) => s.socialState;
export const selectSessionId = (s: ConnectionState) => s.sessionId;
export const selectIsGameConnected = (s: ConnectionState) =>
  s.gameState === WsClientState.CONNECTED;
export const selectIsSocialConnected = (s: ConnectionState) =>
  s.socialState === WsClientState.CONNECTED;

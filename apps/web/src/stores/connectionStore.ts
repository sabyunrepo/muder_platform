import { create } from "zustand";
import { WsClient, WsClientState } from "@mmp/ws-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Terminal auth result surfaced from the WS layer to the UI.
 * code = a `revoke_log` reason ("banned" / "logged_out_elsewhere" /
 * "password_changed" / "admin_revoked") or "unauthorized" when the
 * server sends auth.invalid_session{resumable=false}.
 */
export interface AuthRevokedState {
  code: string;
  reason: string;
}

export interface ConnectionState {
  gameClient: WsClient | null;
  socialClient: WsClient | null;
  gameState: WsClientState;
  socialState: WsClientState;
  sessionId: string | null;
  /**
   * PR-9: non-null once the server signals auth.revoked or
   * auth.invalid_session{resumable=false}. UI consumers select this to
   * navigate to a blocked / re-login screen. Cleared on disconnect or
   * explicit clearAuthRevoked.
   */
  authRevoked: AuthRevokedState | null;
}

export interface ConnectionActions {
  connectGame: (sessionId: string, token: string) => void;
  connectSocial: (token: string) => void;
  disconnectGame: () => void;
  disconnectSocial: () => void;
  disconnectAll: () => void;
  setGameState: (state: WsClientState) => void;
  setSocialState: (state: WsClientState) => void;
  clearAuthRevoked: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWsBase(): string {
  const { protocol, host } = window.location;
  const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${host}`;
}

/**
 * VITE_MMP_WS_AUTH_PROTOCOL must equal the literal string "true" to
 * activate the new client-side dispatcher. Default off keeps the legacy
 * upgrade-only behaviour for the staged rollout, mirroring the backend
 * MMP_WS_AUTH_PROTOCOL gate.
 */
function authProtocolEnabled(): boolean {
  // Vite injects env vars at build time. In test/SSR contexts where
  // import.meta.env is undefined, fall back to off.
  try {
    return import.meta.env.VITE_MMP_WS_AUTH_PROTOCOL === "true";
  } catch {
    return false;
  }
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
    authRevoked: null,

    connectGame: (sessionId, token) => {
      const { gameClient } = get();
      if (gameClient) {
        gameClient.disconnect();
      }

      const wsBase = buildWsBase();
      const enabled = authProtocolEnabled();
      const client = new WsClient({
        url: `${wsBase}/ws/game?token=${encodeURIComponent(token)}`,
        token,
        authProtocol: enabled,
        onRevoked: (code, reason) => set({ authRevoked: { code, reason } }),
        onUnauthorized: (reason) =>
          set({ authRevoked: { code: "unauthorized", reason } }),
        // onTokenRefreshed wiring (rotate token in useAuthStore) lands
        // alongside auth.refresh_required scheduling — PR-9 ships only
        // the manual refresh path, so nothing to forward yet.
      });

      client.onStateChange((state) => {
        get().setGameState(state);
      });

      set({ gameClient: client, sessionId, authRevoked: null });
      client.connect();
    },

    connectSocial: (token) => {
      const { socialClient } = get();
      if (socialClient) {
        socialClient.disconnect();
      }

      const wsBase = buildWsBase();
      const enabled = authProtocolEnabled();
      const client = new WsClient({
        url: `${wsBase}/ws/social?token=${encodeURIComponent(token)}`,
        token,
        authProtocol: enabled,
        onRevoked: (code, reason) => set({ authRevoked: { code, reason } }),
        onUnauthorized: (reason) =>
          set({ authRevoked: { code: "unauthorized", reason } }),
      });

      client.onStateChange((state) => {
        get().setSocialState(state);
      });

      set({ socialClient: client, authRevoked: null });
      client.connect();
    },

    disconnectGame: () => {
      const { gameClient } = get();
      if (gameClient) {
        gameClient.disconnect();
      }
      set({
        gameClient: null,
        sessionId: null,
        gameState: WsClientState.DISCONNECTED,
      });
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

    clearAuthRevoked: () => {
      set({ authRevoked: null });
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
export const selectAuthRevoked = (s: ConnectionState) => s.authRevoked;

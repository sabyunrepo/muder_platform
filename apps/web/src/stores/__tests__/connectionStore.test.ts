import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// WsClient mock — vi.hoisted로 hoisting 스코프에 선언
// ---------------------------------------------------------------------------

const { mockConnect, mockDisconnect, mockOnStateChange, mockSend, MockWsClient, WsClientState } =
  vi.hoisted(() => {
    const mockConnect = vi.fn();
    const mockDisconnect = vi.fn();
    const mockOnStateChange = vi.fn(() => vi.fn());
    const mockSend = vi.fn();

    const MockWsClient = vi.fn().mockImplementation(() => ({
      connect: mockConnect,
      disconnect: mockDisconnect,
      onStateChange: mockOnStateChange,
      send: mockSend,
      connectionState: 'idle',
    }));

    const WsClientState = {
      IDLE: 'idle' as const,
      CONNECTING: 'connecting' as const,
      CONNECTED: 'connected' as const,
      RECONNECTING: 'reconnecting' as const,
      DISCONNECTED: 'disconnected' as const,
    };

    return {
      mockConnect,
      mockDisconnect,
      mockOnStateChange,
      mockSend,
      MockWsClient,
      WsClientState,
    };
  });

vi.mock('@mmp/ws-client', () => ({
  WsClient: MockWsClient,
  WsClientState,
}));

// Import after mock setup
import { useConnectionStore } from '../connectionStore';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('connectionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConnectionStore.setState({
      gameClient: null,
      socialClient: null,
      gameState: WsClientState.IDLE,
      socialState: WsClientState.IDLE,
      sessionId: null,
      authRevoked: null,
      lastWsError: null,
    });
  });

  describe('초기 상태', () => {
    it('gameClient는 null이다', () => {
      expect(useConnectionStore.getState().gameClient).toBeNull();
    });

    it('socialClient는 null이다', () => {
      expect(useConnectionStore.getState().socialClient).toBeNull();
    });

    it('gameState는 idle이다', () => {
      expect(useConnectionStore.getState().gameState).toBe(WsClientState.IDLE);
    });

    it('socialState는 idle이다', () => {
      expect(useConnectionStore.getState().socialState).toBe(WsClientState.IDLE);
    });

    it('sessionId는 null이다', () => {
      expect(useConnectionStore.getState().sessionId).toBeNull();
    });
  });

  describe('connectGame', () => {
    it('WsClient를 생성한다', () => {
      useConnectionStore.getState().connectGame('session-1', 'token-abc');

      expect(MockWsClient).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/ws/game'),
          token: 'token-abc',
        })
      );
    });

    it('sessionId를 설정한다', () => {
      useConnectionStore.getState().connectGame('session-1', 'token-abc');
      expect(useConnectionStore.getState().sessionId).toBe('session-1');
    });

    it('client.connect()를 호출한다', () => {
      useConnectionStore.getState().connectGame('session-1', 'token-abc');
      expect(mockConnect).toHaveBeenCalled();
    });

    it('gameClient를 저장한다', () => {
      useConnectionStore.getState().connectGame('session-1', 'token-abc');
      expect(useConnectionStore.getState().gameClient).not.toBeNull();
    });

    it('server error callback을 store에 연결한다', () => {
      useConnectionStore.getState().connectGame('session-1', 'token-abc');
      const options = MockWsClient.mock.calls[0][0];
      const payload = {
        code: 4010,
        app_code: 'INTERNAL_ERROR',
        message: '서버 오류가 발생했습니다.',
        severity: 'high',
        retryable: true,
        fatal: false,
      };

      options.onServerError(payload);

      expect(useConnectionStore.getState().lastWsError).toEqual(payload);
    });

    it('onStateChange 콜백을 등록한다', () => {
      useConnectionStore.getState().connectGame('session-1', 'token-abc');
      expect(mockOnStateChange).toHaveBeenCalled();
    });

    it('기존 gameClient가 있으면 disconnect 후 새로 생성한다', () => {
      useConnectionStore.getState().connectGame('session-1', 'token-abc');
      vi.clearAllMocks();

      useConnectionStore.getState().connectGame('session-2', 'token-def');

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
      expect(MockWsClient).toHaveBeenCalledTimes(1);
      expect(useConnectionStore.getState().sessionId).toBe('session-2');
    });
  });

  describe('connectSocial', () => {
    it('WsClient를 생성한다', () => {
      useConnectionStore.getState().connectSocial('token-abc');

      expect(MockWsClient).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/ws/social'),
          token: 'token-abc',
        })
      );
    });

    it('socialClient를 저장한다', () => {
      useConnectionStore.getState().connectSocial('token-abc');
      expect(useConnectionStore.getState().socialClient).not.toBeNull();
    });

    it('social server error callback을 store에 연결한다', () => {
      useConnectionStore.getState().connectSocial('token-abc');
      const options = MockWsClient.mock.calls[0][0];
      const payload = {
        code: 4003,
        app_code: 'SESSION_INBOX_FULL',
        message: '요청이 많아 잠시 후 다시 시도해주세요.',
        severity: 'medium',
        retryable: true,
        fatal: false,
      };

      options.onServerError(payload);

      expect(useConnectionStore.getState().lastWsError).toEqual(payload);
    });

    it('client.connect()를 호출한다', () => {
      useConnectionStore.getState().connectSocial('token-abc');
      expect(mockConnect).toHaveBeenCalled();
    });

    it('기존 socialClient가 있으면 disconnect 후 새로 생성한다', () => {
      useConnectionStore.getState().connectSocial('token-abc');
      vi.clearAllMocks();

      useConnectionStore.getState().connectSocial('token-def');

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
      expect(MockWsClient).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnectSocial', () => {
    it('lastWsError를 null로 초기화한다', () => {
      useConnectionStore.getState().connectSocial('token-abc');
      const options = MockWsClient.mock.calls[0][0];
      options.onServerError({
        code: 4003,
        app_code: 'SESSION_INBOX_FULL',
        message: '요청이 많아 잠시 후 다시 시도해주세요.',
        severity: 'medium',
        retryable: true,
        fatal: false,
      });

      useConnectionStore.getState().disconnectSocial();

      expect(useConnectionStore.getState().lastWsError).toBeNull();
    });
  });

  describe('disconnectGame', () => {
    it('gameClient를 null로 설정한다', () => {
      useConnectionStore.getState().connectGame('session-1', 'token-abc');
      useConnectionStore.getState().disconnectGame();
      expect(useConnectionStore.getState().gameClient).toBeNull();
    });

    it('sessionId를 null로 초기화한다', () => {
      useConnectionStore.getState().connectGame('session-1', 'token-abc');
      useConnectionStore.getState().disconnectGame();
      expect(useConnectionStore.getState().sessionId).toBeNull();
    });

    it('gameState를 disconnected로 설정한다', () => {
      useConnectionStore.getState().connectGame('session-1', 'token-abc');
      useConnectionStore.getState().disconnectGame();
      expect(useConnectionStore.getState().gameState).toBe(WsClientState.DISCONNECTED);
    });

    it('client.disconnect()를 호출한다', () => {
      useConnectionStore.getState().connectGame('session-1', 'token-abc');
      vi.clearAllMocks();

      useConnectionStore.getState().disconnectGame();
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it('lastWsError를 null로 초기화한다', () => {
      useConnectionStore.getState().connectGame('session-1', 'token-abc');
      const options = MockWsClient.mock.calls[0][0];
      options.onServerError({
        code: 4010,
        app_code: 'INTERNAL_ERROR',
        message: '서버 오류가 발생했습니다.',
        severity: 'high',
        retryable: true,
        fatal: false,
      });

      useConnectionStore.getState().disconnectGame();

      expect(useConnectionStore.getState().lastWsError).toBeNull();
    });
  });

  describe('disconnectAll', () => {
    it('모든 client를 null로 설정한다', () => {
      useConnectionStore.getState().connectGame('session-1', 'token-abc');
      useConnectionStore.getState().connectSocial('token-def');

      useConnectionStore.getState().disconnectAll();

      const state = useConnectionStore.getState();
      expect(state.gameClient).toBeNull();
      expect(state.socialClient).toBeNull();
    });

    it('sessionId를 null로 초기화한다', () => {
      useConnectionStore.getState().connectGame('session-1', 'token-abc');
      useConnectionStore.getState().disconnectAll();
      expect(useConnectionStore.getState().sessionId).toBeNull();
    });

    it('모든 state를 disconnected로 설정한다', () => {
      useConnectionStore.getState().connectGame('session-1', 'token-abc');
      useConnectionStore.getState().connectSocial('token-def');

      useConnectionStore.getState().disconnectAll();

      const state = useConnectionStore.getState();
      expect(state.gameState).toBe(WsClientState.DISCONNECTED);
      expect(state.socialState).toBe(WsClientState.DISCONNECTED);
    });

    it('모든 client의 disconnect()를 호출한다', () => {
      useConnectionStore.getState().connectGame('session-1', 'token-abc');
      useConnectionStore.getState().connectSocial('token-def');
      vi.clearAllMocks();

      useConnectionStore.getState().disconnectAll();
      expect(mockDisconnect).toHaveBeenCalledTimes(2);
    });

    it('lastWsError를 null로 초기화한다', () => {
      useConnectionStore.getState().connectGame('session-1', 'token-abc');
      const options = MockWsClient.mock.calls[0][0];
      options.onServerError({
        code: 4010,
        app_code: 'INTERNAL_ERROR',
        message: '서버 오류가 발생했습니다.',
        severity: 'high',
        retryable: true,
        fatal: false,
      });

      useConnectionStore.getState().disconnectAll();

      expect(useConnectionStore.getState().lastWsError).toBeNull();
    });
  });
});

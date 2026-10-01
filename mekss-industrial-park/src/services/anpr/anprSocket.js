import { io } from 'socket.io-client';
import { refreshSession } from '../api/base.api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';
const FRAME_ACK_TIMEOUT_MS = 2500;

/**
 * Live ANPR connection to the NestJS `/anpr` namespace.
 * Emits frames as binary with an ack; results arrive as `frame:result` / `plate:locked` / `plate:candidate`.
 *
 * @param {{
 *   sessionId: string,
 *   onResult?: (outcome: object) => void,
 *   onDecision?: (decision: object, locked: boolean) => void,
 *   onStatus?: (status: 'connected'|'disconnected'|'reconnecting'|'failed', detail?: string) => void,
 * }} handlers
 */
export function createAnprConnection({ sessionId, onResult, onDecision, onStatus }) {
  let refreshed = false;
  const socket = io(`${SOCKET_URL}/anpr`, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: (cb) => cb({ token: localStorage.getItem('accessToken') || '', sessionId }),
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 8000,
    randomizationFactor: 0.4,
    timeout: 5000,
    autoConnect: true,
  });

  socket.on('connect', () => {
    refreshed = false;
    onStatus?.('connected');
  });
  socket.on('disconnect', (reason) => onStatus?.('disconnected', reason));
  socket.io.on('reconnect_attempt', () => onStatus?.('reconnecting'));
  socket.on('connect_error', async (error) => {
    const message = error?.message || 'connect_error';
    if (message === 'unauthorized' && !refreshed) {
      refreshed = true;
      try {
        await refreshSession();
        socket.connect();
        return;
      } catch {
        onStatus?.('failed', 'unauthorized');
        socket.disconnect();
        return;
      }
    }
    if (message === 'forbidden' || message === 'unauthorized') {
      onStatus?.('failed', message);
      socket.disconnect();
      return;
    }
    onStatus?.('failed', message);
  });
  socket.on('frame:result', (outcome) => onResult?.(outcome));
  socket.on('plate:locked', (decision) => onDecision?.(decision, true));
  socket.on('plate:candidate', (decision) => onDecision?.(decision, false));

  return {
    socket,
    get connected() {
      return socket.connected;
    },
    /**
     * @param {number} seq
     * @param {ArrayBuffer} image JPEG bytes
     * @returns {Promise<{ ok: boolean, seq: number, dropped?: boolean, error?: string, status?: number }>}
     */
    sendFrame(seq, image) {
      return new Promise((resolve) => {
        if (!socket.connected) {
          resolve({ ok: false, seq, error: 'disconnected' });
          return;
        }
        socket.timeout(FRAME_ACK_TIMEOUT_MS).emit('frame', { seq, image }, (err, ack) => {
          resolve(err ? { ok: false, seq, error: 'timeout' } : ack || { ok: false, seq, error: 'no-ack' });
        });
      });
    },
    reset(nextSessionId) {
      socket.emit('session:reset', nextSessionId ? { sessionId: nextSessionId } : {});
    },
    confirm(payload) {
      return new Promise((resolve) => {
        if (!socket.connected) {
          resolve({ ok: false, error: 'disconnected' });
          return;
        }
        socket.timeout(4000).emit('confirm', payload, (err, ack) => resolve(err ? { ok: false, error: 'timeout' } : ack));
      });
    },
    close() {
      socket.removeAllListeners();
      socket.io.removeAllListeners();
      socket.disconnect();
    },
  };
}

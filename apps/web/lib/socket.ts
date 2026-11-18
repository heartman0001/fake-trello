import { io, Socket } from 'socket.io-client';
import { getCookie } from 'cookies-next';
import { API_BASE_URL } from './api';

const SOCKET_URL =
  process.env.NEXT_PUBLIC_WS_URL || API_BASE_URL.replace(/\/api$/, '');

export function createBoardSocket(boardId: string): Socket {
  const token = getCookie('accessToken');

  const socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    socket.emit('board:join', { boardId });
  });

  return socket;
}

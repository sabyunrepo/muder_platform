type RoomStatus = 'waiting' | 'playing' | 'full' | string;

export function normalizeRoomStatus(status: string): RoomStatus {
  return status.toLowerCase();
}

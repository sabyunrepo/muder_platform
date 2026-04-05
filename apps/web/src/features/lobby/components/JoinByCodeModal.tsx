import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Modal, Button, Input } from '@/shared/components/ui';
import { useRoomByCode, useJoinRoom } from '../api';

interface JoinByCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JoinByCodeModal({ isOpen, onClose }: JoinByCodeModalProps) {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const joinRoom = useJoinRoom();

  // 6자리 코드가 입력되면 방 조회 활성화
  const trimmedCode = code.trim().toUpperCase();
  const isCodeValid = trimmedCode.length === 6;
  const { data: room, isLoading: isSearching, isError: isNotFound } = useRoomByCode(
    isCodeValid ? trimmedCode : '',
  );

  const handleJoin = () => {
    if (!room) return;
    joinRoom.mutate(room.id, {
      onSuccess: (data) => {
        onClose();
        setCode('');
        navigate(`/room/${data.id}`);
      },
    });
  };

  const handleClose = () => {
    setCode('');
    onClose();
  };

  // 상태 메시지
  let statusMessage = '';
  if (isCodeValid && isSearching) {
    statusMessage = '방을 찾는 중...';
  } else if (isCodeValid && isNotFound) {
    statusMessage = '해당 코드의 방을 찾을 수 없습니다.';
  } else if (room) {
    statusMessage = `${room.theme_title} — ${room.host_nickname}의 방 (${room.player_count}/${room.max_players})`;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="코드로 참가"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button
            onClick={handleJoin}
            disabled={!room}
            isLoading={joinRoom.isPending}
          >
            참가
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="방 코드"
          placeholder="6자리 코드 입력"
          value={code}
          onChange={(e) => setCode(e.target.value.slice(0, 6))}
          maxLength={6}
          className="text-center font-mono text-lg tracking-widest"
          autoFocus
        />
        {statusMessage && (
          <p
            className={`text-sm ${
              isNotFound ? 'text-red-400' : 'text-slate-400'
            }`}
          >
            {statusMessage}
          </p>
        )}
      </div>
    </Modal>
  );
}

import { useState } from "react";
import { toast } from "sonner";
import { Button, Input, Modal } from "@/shared/components/ui";
import { useSendFriendRequest } from "@/features/social/api";

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddFriendModal({ isOpen, onClose }: AddFriendModalProps) {
  const [userId, setUserId] = useState("");
  const sendRequest = useSendFriendRequest();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = userId.trim();
    if (!trimmed) return;

    sendRequest.mutate(
      { addressee_id: trimmed },
      {
        onSuccess: () => {
          toast.success("친구 요청을 보냈습니다");
          setUserId("");
          onClose();
        },
        onError: (err) => {
          toast.error(err.message || "친구 요청에 실패했습니다");
        },
      },
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="친구 추가">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="사용자 ID"
          placeholder="친구의 사용자 ID를 입력하세요"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          autoFocus
        />
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={sendRequest.isPending}>
            취소
          </Button>
          <Button type="submit" isLoading={sendRequest.isPending} disabled={!userId.trim()}>
            요청 보내기
          </Button>
        </div>
      </form>
    </Modal>
  );
}

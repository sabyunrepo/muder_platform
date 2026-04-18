import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { useDeleteAccount } from "@/features/profile/api";
import { useAuthStore } from "@/stores/authStore";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DeleteAccountModalProps {
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// DeleteAccountModal
// ---------------------------------------------------------------------------

export function DeleteAccountModal({ onClose }: DeleteAccountModalProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isOAuth = user?.provider !== "local";

  const [nicknameInput, setNicknameInput] = useState("");
  const [password, setPassword] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);

  const { mutate: deleteAccount, isPending, error } = useDeleteAccount();

  const nicknameMatches = nicknameInput === user?.nickname;
  const passwordFilled = isOAuth || password.length > 0;
  const readyToDelete = nicknameMatches && passwordFilled;

  // 조건 충족 시 5s 카운트다운, 조건 해제 시 리셋
  useEffect(() => {
    if (!readyToDelete) {
      setCountdown(null);
      return;
    }

    setCountdown(5);
    let remaining = 5;
    const timer = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [readyToDelete]);

  const canSubmit = countdown === 0 && !isPending;

  function handleDelete() {
    if (!canSubmit) return;
    deleteAccount(
      { password: isOAuth ? undefined : password },
      {
        onSuccess: () => {
          navigate("/login", { replace: true });
        },
      },
    );
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-md rounded-xl bg-slate-900 p-6 shadow-xl">
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="닫기"
        >
          <X className="h-5 w-5" />
        </button>

        {/* 헤더 */}
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-900/40">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              정말로 계정을 삭제하시겠습니까?
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              계정을 삭제하면 모든 데이터가 영구적으로 삭제되며 복구할 수
              없습니다.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* 닉네임 확인 */}
          <div>
            <label className="mb-1.5 block text-sm text-slate-400">
              본인의 닉네임{" "}
              <span className="font-medium text-slate-200">
                {user?.nickname}
              </span>
              을 입력하세요
            </label>
            <input
              type="text"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder={user?.nickname ?? ""}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
            />
          </div>

          {/* 비밀번호 (OAuth 제외) */}
          {!isOAuth && (
            <div>
              <label className="mb-1.5 block text-sm text-slate-400">
                비밀번호를 입력하세요
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
              />
            </div>
          )}

          {/* 에러 */}
          {error && (
            <p className="text-sm text-red-400">{error.message}</p>
          )}

          {/* 액션 버튼 */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
            >
              취소
            </button>
            <button
              onClick={handleDelete}
              disabled={!canSubmit}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {countdown !== null && countdown > 0
                ? `삭제 (${countdown}s)`
                : isPending
                  ? "삭제 중..."
                  : "삭제"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

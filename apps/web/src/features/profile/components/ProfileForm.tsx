import { useState, useCallback, useMemo } from "react";
import { User as UserIcon, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Badge } from "@/shared/components/ui";
import { useUpdateProfile } from "../api";
import { useAuthStore } from "@/stores/authStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileFormProps {
  nickname: string;
  email: string;
  profileImage: string | null;
  role: string;
  provider: string;
}

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;

/** OAuth 제공자 표시 이름 */
const providerLabel: Record<string, string> = {
  google: "Google",
  kakao: "Kakao",
  naver: "Naver",
  github: "GitHub",
};

// ---------------------------------------------------------------------------
// ProfileForm
// ---------------------------------------------------------------------------

export function ProfileForm({
  nickname: initialNickname,
  email,
  profileImage,
  role,
  provider,
}: ProfileFormProps) {
  const [nickname, setNickname] = useState(initialNickname);
  const [nicknameError, setNicknameError] = useState<string | undefined>();

  const updateProfile = useUpdateProfile();
  const setUser = useAuthStore((s) => s.setUser);
  const currentUser = useAuthStore((s) => s.user);

  // 변경 여부 체크
  const hasChanges = useMemo(
    () => nickname.trim() !== initialNickname,
    [nickname, initialNickname],
  );

  // 닉네임 유효성 검증
  const validate = useCallback((): boolean => {
    const trimmed = nickname.trim();
    if (trimmed.length === 0) {
      setNicknameError("닉네임을 입력해주세요.");
      return false;
    }
    if (trimmed.length < NICKNAME_MIN) {
      setNicknameError(`닉네임은 ${NICKNAME_MIN}자 이상이어야 합니다.`);
      return false;
    }
    if (trimmed.length > NICKNAME_MAX) {
      setNicknameError(`닉네임은 ${NICKNAME_MAX}자 이하여야 합니다.`);
      return false;
    }
    setNicknameError(undefined);
    return true;
  }, [nickname]);

  // 저장
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      updateProfile.mutate(
        { nickname: nickname.trim() },
        {
          onSuccess: (data) => {
            // authStore 업데이트
            if (currentUser) {
              setUser({
                ...currentUser,
                nickname: data.nickname,
                profileImage: data.profile_image,
              });
            }
            toast.success("프로필이 저장되었습니다.");
          },
          onError: (error) => {
            toast.error(error.message || "프로필 저장에 실패했습니다.");
          },
        },
      );
    },
    [nickname, validate, updateProfile, setUser, currentUser],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 아바타 */}
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 border border-slate-700">
          {profileImage ? (
            <img
              src={profileImage}
              alt={nickname}
              className="h-full w-full object-cover"
            />
          ) : (
            <UserIcon className="h-10 w-10 text-slate-500" />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm text-slate-400">프로필 이미지</p>
          <p className="text-xs text-slate-500">
            이미지 업로드는 추후 지원 예정입니다.
          </p>
        </div>
      </div>

      {/* 닉네임 */}
      <Input
        label="닉네임"
        value={nickname}
        onChange={(e) => {
          setNickname(e.target.value);
          if (nicknameError) setNicknameError(undefined);
        }}
        error={nicknameError}
        placeholder="닉네임을 입력하세요"
        maxLength={NICKNAME_MAX}
        autoComplete="nickname"
      />

      {/* 이메일 (읽기 전용) */}
      <Input
        label="이메일"
        value={email}
        readOnly
        leftIcon={<Lock className="h-4 w-4" />}
        className="cursor-not-allowed opacity-70"
      />

      {/* OAuth 제공자 (읽기 전용) */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-300">로그인 방식</span>
        <Badge variant="info" size="md">
          {providerLabel[provider] ?? provider}
        </Badge>
      </div>

      {/* 저장 버튼 */}
      <Button
        type="submit"
        disabled={!hasChanges}
        isLoading={updateProfile.isPending}
      >
        저장
      </Button>
    </form>
  );
}

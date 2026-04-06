import { useRef, useState, useCallback } from "react";
import { Camera, Upload, RotateCcw, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/Button";
import { Spinner } from "@/shared/components/ui/Spinner";
import { useUploadAvatar, useUpdateProfile } from "@/features/profile/api";
import { useAuthStore } from "@/stores/authStore";
import { AvatarCropModal } from "./AvatarCropModal";
import { AvatarPresetGrid } from "./AvatarPresetGrid";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_DIMENSION_PX = 2048;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateImage(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      resolve("이미지 크기는 2MB 이하여야 합니다.");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width > MAX_DIMENSION_PX || img.height > MAX_DIMENSION_PX) {
        resolve(`이미지 해상도는 ${MAX_DIMENSION_PX}px 이하여야 합니다.`);
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("이미지를 읽을 수 없습니다.");
    };
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// AvatarSection
// ---------------------------------------------------------------------------

interface AvatarSectionProps {
  avatarUrl: string | null;
  nickname: string;
}

export function AvatarSection({ avatarUrl, nickname }: AvatarSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  const uploadAvatar = useUploadAvatar();
  const updateProfile = useUpdateProfile();
  const setUser = useAuthStore((s) => s.setUser);
  const currentUser = useAuthStore((s) => s.user);

  const isLoading = uploadAvatar.isPending || updateProfile.isPending;

  // 업로드 후 authStore 동기화
  const syncUser = useCallback(
    (newAvatarUrl: string | null) => {
      if (currentUser) {
        setUser({ ...currentUser, profileImage: newAvatarUrl });
      }
    },
    [currentUser, setUser],
  );

  // 파일 선택 → 검증 → 크롭 모달 오픈
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!fileInputRef.current) return;
      fileInputRef.current.value = "";

      if (!file) return;

      const error = await validateImage(file);
      if (error) {
        toast.error(error);
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      setCropSrc(objectUrl);
    },
    [],
  );

  // 크롭 완료 → 업로드
  const handleCropApply = useCallback(
    (blob: Blob) => {
      uploadAvatar.mutate(blob, {
        onSuccess: (data) => {
          syncUser(data.avatar_url);
          toast.success("아바타가 업데이트되었습니다.");
        },
        onError: (err) => {
          toast.error(err.message || "아바타 업로드에 실패했습니다.");
        },
      });
    },
    [uploadAvatar, syncUser],
  );

  // 크롭 모달 닫기 + objectURL 해제
  const handleCropClose = useCallback(() => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }, [cropSrc]);

  // 프리셋 선택 → updateProfile
  const handlePresetSelect = useCallback(
    (url: string) => {
      updateProfile.mutate(
        { avatar_url: url },
        {
          onSuccess: (data) => {
            syncUser(data.avatar_url);
            setShowPresets(false);
            toast.success("프리셋 아바타가 적용되었습니다.");
          },
          onError: (err) => {
            toast.error(err.message || "아바타 변경에 실패했습니다.");
          },
        },
      );
    },
    [updateProfile, syncUser],
  );

  // 기본으로 리셋
  const handleReset = useCallback(() => {
    updateProfile.mutate(
      { avatar_url: null },
      {
        onSuccess: () => {
          syncUser(null);
          toast.success("기본 아바타로 변경되었습니다.");
        },
        onError: (err) => {
          toast.error(err.message || "아바타 초기화에 실패했습니다.");
        },
      },
    );
  }, [updateProfile, syncUser]);

  return (
    <div className="space-y-3">
      {/* 현재 아바타 + 버튼 행 */}
      <div className="flex items-center gap-4">
        {/* 아바타 프리뷰 (128x128) */}
        <div className="relative h-32 w-32 shrink-0">
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-800 border border-slate-700">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={nickname}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserIcon className="h-14 w-14 text-slate-500" />
            )}
          </div>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
              <Spinner size="md" />
            </div>
          )}
        </div>

        {/* 액션 버튼 그룹 */}
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Upload className="h-4 w-4" />}
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            이미지 변경
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Camera className="h-4 w-4" />}
            onClick={() => setShowPresets((v) => !v)}
            disabled={isLoading}
          >
            프리셋에서 선택
          </Button>
          {avatarUrl && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RotateCcw className="h-4 w-4" />}
              onClick={handleReset}
              disabled={isLoading}
            >
              기본으로 리셋
            </Button>
          )}
        </div>
      </div>

      {/* 프리셋 그리드 (토글) */}
      {showPresets && (
        <AvatarPresetGrid selectedUrl={avatarUrl} onSelect={handlePresetSelect} />
      )}

      {/* 숨긴 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
      />

      {/* 크롭 모달 */}
      {cropSrc && (
        <AvatarCropModal
          isOpen
          imageSrc={cropSrc}
          onClose={handleCropClose}
          onApply={handleCropApply}
        />
      )}
    </div>
  );
}

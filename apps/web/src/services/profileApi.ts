import { useAuthStore } from "@/stores/authStore";

const BASE_URL = "/api";

export const profileApi = {
  uploadAvatar: async (file: Blob): Promise<{ avatar_url: string }> => {
    const accessToken = useAuthStore.getState().accessToken;
    const formData = new FormData();
    formData.append("avatar", file, "avatar.webp");

    const headers: HeadersInit = {};
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const res = await fetch(`${BASE_URL}/v1/profile/avatar`, {
      method: "PUT",
      headers,
      credentials: "include",
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.detail ?? "아바타 업로드에 실패했습니다.");
    }

    return res.json();
  },
};

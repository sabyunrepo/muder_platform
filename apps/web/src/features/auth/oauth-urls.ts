// ---------------------------------------------------------------------------
// OAuth URL 유틸리티
// ---------------------------------------------------------------------------

const KAKAO_CLIENT_ID = import.meta.env.VITE_KAKAO_CLIENT_ID as string;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

export function buildRedirectUri(provider: string): string {
  return `${window.location.origin}/auth/callback?provider=${provider}`;
}

function generateOAuthState(): string {
  const state = crypto.randomUUID();
  sessionStorage.setItem("oauth_state", state);
  return state;
}

export function getOAuthUrl(provider: "kakao" | "google"): string {
  const redirectUri = buildRedirectUri(provider);
  const state = generateOAuthState();

  if (provider === "kakao") {
    return (
      `https://kauth.kakao.com/oauth/authorize` +
      `?client_id=${KAKAO_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&state=${state}`
    );
  }

  return (
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=openid%20email%20profile` +
    `&state=${state}`
  );
}

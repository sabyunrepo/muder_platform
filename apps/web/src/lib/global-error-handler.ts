import { toast } from "sonner";

/**
 * 글로벌 에러 핸들러를 등록한다.
 * unhandled promise rejection과 전역 에러를 캡처하여 토스트로 알림.
 */
export function setupGlobalErrorHandlers(): void {
  window.addEventListener("unhandledrejection", (event) => {
    // 프로덕션에서는 raw 에러 메시지 노출 방지
    const message = import.meta.env.DEV
      ? (event.reason?.message ?? "처리되지 않은 오류가 발생했습니다.")
      : "처리되지 않은 오류가 발생했습니다.";

    if (import.meta.env.DEV) {
      console.error("[unhandledrejection]", event.reason);
    }

    toast.error(message, { duration: 5000 });
  });

  window.addEventListener("error", (event) => {
    // chunk loading 실패 시 새로고침 안내
    if (event.message?.includes("Loading chunk")) {
      toast.error("앱이 업데이트되었습니다. 새로고침해주세요.", {
        duration: Infinity,
        action: {
          label: "새로고침",
          onClick: () => window.location.reload(),
        },
      });
      return;
    }

    if (import.meta.env.DEV) {
      console.error("[global error]", event.error);
    }
  });
}

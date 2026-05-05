import { QueryClient } from "@tanstack/react-query";
import { showErrorToast } from "@/lib/show-error-toast";
import { ApiHttpError } from "@/lib/api-error";
import { shouldRetryApiError } from "@/lib/error-recovery";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: (failureCount, error) => {
        if (error instanceof ApiHttpError) {
          return shouldRetryApiError(error.apiError, failureCount);
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        if (error instanceof ApiHttpError) {
          showErrorToast(error.apiError);
        }
      },
    },
  },
});

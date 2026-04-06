import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

interface UseAutoSaveOptions<T> {
  data: T;
  mutationFn: (data: T) => Promise<unknown>;
  debounceMs?: number;
  enabled?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface UseAutoSaveReturn {
  status: SaveStatus;
  lastSaved: Date | null;
  save: () => void;
  retry: () => void;
}

// ---------------------------------------------------------------------------
// useAutoSave
// ---------------------------------------------------------------------------

export function useAutoSave<T>({
  data,
  mutationFn,
  debounceMs = 5000,
  enabled = true,
  onSuccess,
  onError,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const initialDataRef = useRef<string>(JSON.stringify(data));
  const latestDataRef = useRef<T>(data);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingAfterSaveRef = useRef(false);
  const isSavingRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep latest data ref in sync
  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  const executeSave = useCallback(
    async (dataToSave: T) => {
      if (!enabled) return;

      // Cancel any in-flight request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      isSavingRef.current = true;
      setStatus("saving");

      try {
        await mutationFn(dataToSave);
        isSavingRef.current = false;
        initialDataRef.current = JSON.stringify(dataToSave);
        setLastSaved(new Date());
        setStatus("saved");
        onSuccess?.();

        // Transition saved → idle after 2 seconds
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => {
          setStatus((prev) => (prev === "saved" ? "idle" : prev));
        }, 2000);

        // If a new change arrived while saving, re-save
        if (pendingAfterSaveRef.current) {
          pendingAfterSaveRef.current = false;
          scheduleSave();
        }
      } catch (err) {
        isSavingRef.current = false;
        if (err instanceof Error && err.name === "AbortError") return;
        setStatus("error");
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, mutationFn, onSuccess, onError],
  );

  const scheduleSave = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (isSavingRef.current) {
        pendingAfterSaveRef.current = true;
        return;
      }
      executeSave(latestDataRef.current);
    }, debounceMs);
  }, [debounceMs, executeSave]);

  // Detect changes and mark dirty
  useEffect(() => {
    if (!enabled) return;
    const serialized = JSON.stringify(data);
    if (serialized === initialDataRef.current) return;

    setStatus("dirty");
    scheduleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, enabled]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        if (status === "dirty" && !isSavingRef.current) {
          executeSave(latestDataRef.current);
        }
      }
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      abortControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn on tab close when dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [status]);

  const save = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    executeSave(latestDataRef.current);
  }, [executeSave]);

  const retry = useCallback(() => {
    if (status !== "error") return;
    executeSave(latestDataRef.current);
  }, [status, executeSave]);

  return { status, lastSaved, save, retry };
}

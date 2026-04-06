import { useState, useEffect } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Returns `true` when the user has enabled "reduce motion" in their OS settings.
 * Listens for live changes (e.g. toggling the setting while the app is open).
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return prefersReduced;
}

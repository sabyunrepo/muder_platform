import { useState, useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/**
 * easeOutQuart: fast start, slow finish.
 */
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

const DEFAULT_DURATION = 1500;

/**
 * Animates a number from 0 → `target` using requestAnimationFrame.
 * Returns the current display value (integer).
 *
 * - Respects `prefers-reduced-motion`: returns `target` immediately.
 * - Re-runs when `target` changes.
 */
export function useCountUp(target: number, duration = DEFAULT_DURATION): number {
  const prefersReduced = usePrefersReducedMotion();
  const [value, setValue] = useState(prefersReduced ? target : 0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (prefersReduced) {
      setValue(target);
      return;
    }

    if (target === 0) {
      setValue(0);
      return;
    }

    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutQuart(progress);
      setValue(Math.round(eased * target));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, prefersReduced]);

  return value;
}

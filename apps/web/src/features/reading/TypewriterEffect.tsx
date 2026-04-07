import { useEffect, useRef, useState } from "react";

export interface TypewriterEffectProps {
  text: string;
  /** When provided, distributes the reveal across this duration. */
  durationMs?: number | null;
  /** Default speed when durationMs is not provided. */
  speedMsPerChar?: number;
  onComplete?: () => void;
  className?: string;
}

/**
 * Renders text with a per-character typewriter reveal. Click the rendered
 * paragraph to skip to the fully revealed text.
 */
export function TypewriterEffect({
  text,
  durationMs,
  speedMsPerChar = 40,
  onComplete,
  className,
}: TypewriterEffectProps) {
  const [displayed, setDisplayed] = useState("");
  const completedRef = useRef(false);
  // Keep the latest onComplete in a ref so the reveal effect does not
  // restart when the parent re-renders with a fresh inline callback. Prior
  // versions listed onComplete in the effect deps and would jump back to
  // index 0 on every parent render, defeating the typewriter animation.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    completedRef.current = false;
    if (!text) {
      setDisplayed("");
      return;
    }

    const interval =
      durationMs != null && text.length > 0
        ? Math.max(10, Math.floor(durationMs / text.length))
        : speedMsPerChar;

    let cancelled = false;
    let i = 0;
    setDisplayed("");

    const tick = () => {
      if (cancelled) return;
      i++;
      setDisplayed(text.slice(0, i));
      if (i < text.length) {
        timer = setTimeout(tick, interval);
      } else if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current?.();
      }
    };

    let timer = setTimeout(tick, interval);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // onComplete is intentionally omitted — captured via ref above so that
    // a new callback identity from the parent does not reset the reveal.
  }, [text, durationMs, speedMsPerChar]);

  const handleSkip = () => {
    if (displayed.length < text.length) {
      setDisplayed(text);
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current?.();
      }
    }
  };

  return (
    <p
      className={
        className ??
        "text-base text-slate-100 leading-relaxed whitespace-pre-wrap cursor-pointer"
      }
      onClick={handleSkip}
      data-testid="typewriter-text"
    >
      {displayed}
    </p>
  );
}

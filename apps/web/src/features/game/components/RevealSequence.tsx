import { useState, useEffect, useCallback } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RevealSequenceProps {
  culpritName: string;
  isCulprit: boolean;
  onComplete: () => void;
}

type Step = "dim" | "intro" | "count3" | "count2" | "count1" | "reveal" | "result";

// ---------------------------------------------------------------------------
// 타이밍 (ms)
// ---------------------------------------------------------------------------

const TIMING: Record<Step, number> = {
  dim: 500,
  intro: 1000,
  count3: 1000,
  count2: 1000,
  count1: 1000,
  reveal: 1000,
  result: 0, // 마지막 — 자동 전환 없음
};

const STEPS_ORDERED: Step[] = ["dim", "intro", "count3", "count2", "count1", "reveal", "result"];

// ---------------------------------------------------------------------------
// RevealSequence — 범인 폭로 풀스크린 시퀀스
// ---------------------------------------------------------------------------

export function RevealSequence({ culpritName, isCulprit, onComplete }: RevealSequenceProps) {
  const prefersReduced = usePrefersReducedMotion();
  const [step, setStep] = useState<Step>(prefersReduced ? "result" : "dim");

  // 단계별 자동 전환
  const advance = useCallback(() => {
    setStep((prev) => {
      const idx = STEPS_ORDERED.indexOf(prev);
      const next = STEPS_ORDERED[idx + 1];
      return next ?? prev;
    });
  }, []);

  useEffect(() => {
    if (prefersReduced) return;
    if (step === "result") return;

    const delay = TIMING[step];
    const timer = setTimeout(advance, delay);
    return () => clearTimeout(timer);
  }, [step, advance, prefersReduced]);

  // 역할 텍스트 / 스타일
  const roleLabel = isCulprit ? "범인" : "시민";
  const roleColor = isCulprit ? "text-red-400" : "text-amber-400";
  const ringColor = isCulprit ? "ring-red-500/30" : "ring-amber-500/30";

  // reduced-motion: 딤 + 결과 즉시
  if (prefersReduced) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95"
        role="alert"
        aria-live="assertive"
      >
        <ResultCard
          culpritName={culpritName}
          roleLabel={roleLabel}
          roleColor={roleColor}
          ringColor={ringColor}
          onComplete={onComplete}
        />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      role="alert"
      aria-live="assertive"
    >
      {/* Step 1: Dim overlay */}
      <div
        className={`absolute inset-0 bg-slate-950/95 transition-opacity duration-500 ${
          step === "dim" ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* Content layer */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Step 2: Intro text + glow line */}
        {(step === "intro" || step === "count3" || step === "count2" || step === "count1") && (
          <div className="flex flex-col items-center gap-4">
            <p
              className={`text-lg text-slate-400 ${
                step === "intro" ? "motion-safe:animate-fade-in" : ""
              }`}
            >
              범인이 밝혀집니다...
            </p>
            {step === "intro" && (
              <div className="h-px w-64 overflow-hidden bg-slate-800">
                <div className="h-full motion-safe:animate-glow-expand bg-amber-500/60" />
              </div>
            )}
          </div>
        )}

        {/* Step 3: Countdown */}
        {step === "count3" && <CountdownDigit digit={3} isLast={false} />}
        {step === "count2" && <CountdownDigit digit={2} isLast={false} />}
        {step === "count1" && <CountdownDigit digit={1} isLast />}

        {/* Step 4+5: Reveal + Result card */}
        {(step === "reveal" || step === "result") && (
          <div
            className={`${
              step === "reveal" ? "motion-safe:animate-fade-in" : ""
            }`}
          >
            <ResultCard
              culpritName={culpritName}
              roleLabel={roleLabel}
              roleColor={roleColor}
              ringColor={ringColor}
              onComplete={onComplete}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CountdownDigit
// ---------------------------------------------------------------------------

function CountdownDigit({ digit, isLast }: { digit: number; isLast: boolean }) {
  const color = isLast ? "text-amber-300" : "text-amber-500";
  return (
    <span
      className={`motion-safe:animate-scale-pulse text-3xl font-bold ${color}`}
      aria-label={`${digit}`}
    >
      {digit}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ResultCard
// ---------------------------------------------------------------------------

function ResultCard({
  culpritName,
  roleLabel,
  roleColor,
  ringColor,
  onComplete,
}: {
  culpritName: string;
  roleLabel: string;
  roleColor: string;
  ringColor: string;
  onComplete: () => void;
}) {
  return (
    <div className="motion-safe:animate-fade-slide-up flex flex-col items-center gap-4">
      <div
        className={`rounded-2xl border border-slate-700 bg-slate-900 px-8 py-6 ring-2 ${ringColor}`}
      >
        <p className="mb-2 text-center text-sm text-slate-400">정체가 밝혀졌습니다</p>
        <p className={`text-center text-2xl font-bold ${roleColor}`}>
          {culpritName}
        </p>
        <p className={`mt-1 text-center text-sm font-medium ${roleColor}`}>
          {roleLabel}
        </p>
      </div>
      <button
        type="button"
        className="rounded-lg border border-slate-600 bg-slate-800 px-6 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
        onClick={onComplete}
      >
        확인
      </button>
    </div>
  );
}

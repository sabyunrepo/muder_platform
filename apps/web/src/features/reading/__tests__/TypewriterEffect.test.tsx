import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TypewriterEffect } from "../TypewriterEffect";

describe("TypewriterEffect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("starts empty and progressively reveals characters at the default speed", () => {
    render(<TypewriterEffect text="abcd" speedMsPerChar={50} />);
    const node = screen.getByTestId("typewriter-text");

    expect(node.textContent).toBe("");

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(node.textContent).toBe("a");

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(node.textContent).toBe("ab");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(node.textContent).toBe("abcd");
  });

  it("calls onComplete after the full text is revealed", () => {
    const onComplete = vi.fn();
    render(
      <TypewriterEffect text="hi" speedMsPerChar={20} onComplete={onComplete} />
    );

    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("restarts reveal when text changes mid-animation", () => {
    const { rerender } = render(
      <TypewriterEffect text="hello" speedMsPerChar={30} />
    );
    const node = screen.getByTestId("typewriter-text");

    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(node.textContent).toBe("he");

    rerender(<TypewriterEffect text="world" speedMsPerChar={30} />);
    expect(node.textContent).toBe("");

    act(() => {
      vi.advanceTimersByTime(30);
    });
    expect(node.textContent).toBe("w");
  });

  it("distributes durationMs evenly across characters", () => {
    render(<TypewriterEffect text="abcde" durationMs={500} />);
    const node = screen.getByTestId("typewriter-text");

    // 500 / 5 = 100ms per char
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(node.textContent).toBe("a");

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(node.textContent).toBe("abcde");
  });

  it("clamps very small durationMs to a 10ms floor per char", () => {
    render(<TypewriterEffect text="abc" durationMs={1} />);
    const node = screen.getByTestId("typewriter-text");

    act(() => {
      vi.advanceTimersByTime(30);
    });
    expect(node.textContent).toBe("abc");
  });

  it("skips to full text on click and fires onComplete", () => {
    const onComplete = vi.fn();
    render(
      <TypewriterEffect
        text="long text here"
        speedMsPerChar={1000}
        onComplete={onComplete}
      />
    );
    const node = screen.getByTestId("typewriter-text");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(node.textContent).toBe("l");

    fireEvent.click(node);
    expect(node.textContent).toBe("long text here");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("does NOT restart the reveal when parent re-renders with a new onComplete identity", () => {
    // Regression for H3: the effect previously listed onComplete in its
    // dependency array, so a parent re-render with an inline callback
    // reset the reveal back to character 0.
    const { rerender } = render(
      <TypewriterEffect text="abcdef" speedMsPerChar={20} onComplete={() => {}} />
    );
    const node = screen.getByTestId("typewriter-text");

    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(node.textContent).toBe("abc");

    // Re-render with a fresh callback identity — reveal must continue, not reset.
    rerender(
      <TypewriterEffect text="abcdef" speedMsPerChar={20} onComplete={() => {}} />
    );
    expect(node.textContent).toBe("abc");

    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(node.textContent).toBe("abcd");
  });

  it("calls the LATEST onComplete after parent re-renders with a new callback", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(
      <TypewriterEffect text="hi" speedMsPerChar={10} onComplete={first} />
    );

    act(() => {
      vi.advanceTimersByTime(10);
    });

    rerender(<TypewriterEffect text="hi" speedMsPerChar={10} onComplete={second} />);

    act(() => {
      vi.advanceTimersByTime(10);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("renders empty when text is empty string", () => {
    render(<TypewriterEffect text="" speedMsPerChar={20} />);
    const node = screen.getByTestId("typewriter-text");
    expect(node.textContent).toBe("");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(node.textContent).toBe("");
  });
});

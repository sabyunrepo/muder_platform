import { describe, expect, it } from "vitest";

import { createVideoPlayer } from "./createVideoPlayer";
import { YouTubeVideoPlayer } from "./YouTubeVideoPlayer";

describe("createVideoPlayer", () => {
  it("returns a YouTubeVideoPlayer instance for YOUTUBE", () => {
    const player = createVideoPlayer("YOUTUBE");
    expect(player).toBeInstanceOf(YouTubeVideoPlayer);
  });

  it("throws with the Phase 7.7/7.8 roadmap message for FILE", () => {
    expect(() => createVideoPlayer("FILE")).toThrow(/Phase 7\.7/);
    expect(() => createVideoPlayer("FILE")).toThrow(/Phase 7\.8\+/);
  });

  it("throws for unknown sourceType", () => {
    expect(() =>
      createVideoPlayer("BOGUS" as unknown as "FILE" | "YOUTUBE"),
    ).toThrow(/unknown sourceType/);
  });
});

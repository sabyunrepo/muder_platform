import type { WsEventType } from "./types.generated.js";

/** WebSocket message envelope shared between Go server and TS clients. */
export interface WsMessage<T = unknown> {
  type: WsEventType;
  payload: T;
  ts: number;
  seq: number;
}

// The WS event catalog — the `WsEventType` enum plus `WsEventDirection`,
// `WsEventCategory`, `WsEventStatus` metadata maps — is generated from
// the Go SSOT in apps/server/internal/ws/envelope_catalog_*.go.
//
// Regenerate after editing the catalog:
//   cd apps/server && go run ./cmd/wsgen
//
// Never hand-edit the generated file; CI (Phase 19 PR-1, gate added in
// PR-G) fails on any diff between `go run ./cmd/wsgen` output and the
// committed copy.
export * from "./types.generated.js";

package ws

//go:generate go run ../../cmd/wsgen -catalog-dir . -out ../../../../packages/shared/src/ws/types.generated.ts

import "encoding/json"

// Direction indicates which endpoints may send a given WS event.
type Direction uint8

const (
	// DirUnknown is the zero value; must not appear in a registered EventDef.
	DirUnknown Direction = 0
	// DirC2S — client sends, server receives.
	DirC2S Direction = 1
	// DirS2C — server sends, client receives.
	DirS2C Direction = 2
	// DirBidi — both endpoints send this event type.
	DirBidi Direction = 3
)

func (d Direction) String() string {
	switch d {
	case DirC2S:
		return "c2s"
	case DirS2C:
		return "s2c"
	case DirBidi:
		return "bidi"
	default:
		return "unknown"
	}
}

// EventStatus marks lifecycle for each Catalog entry.
type EventStatus uint8

const (
	// StatusActive — live, may be sent/received in production.
	StatusActive EventStatus = 0
	// StatusStub — declared for codegen only; no server handler yet.
	//   e.g. PR-1 reserves "auth.*" slots for PR-9 (WS Auth Protocol).
	StatusStub EventStatus = 1
	// StatusDeprec — still wired but slated for removal in a follow-up PR.
	StatusDeprec EventStatus = 2
)

// EventDef declares a single WebSocket event type.
//
// The package-level Catalog (aggregated across envelope_catalog_*.go via
// init() → RegisterCatalog) is the platform-wide SSOT for WS events.
// `apps/server/cmd/wsgen` consumes it to produce the frontend enum
// (packages/shared/src/ws/types.generated.ts); MSW handlers and reducers
// are validated against the same source.
//
// Naming policy (Phase 19 PR-1): the canonical form for NEW events is dot
// notation "<category>.<action>" (e.g. "phase.advanced"). Legacy colon
// entries ("ns:action") are preserved as-is to avoid cross-module migration
// churn — full normalisation is tracked as a Phase 20 follow-up.
type EventDef struct {
	Type      string      // canonical event type string
	Direction Direction   // c2s / s2c / bidi
	Category  string      // coarse grouping (system, chat, phase, clue, ...)
	Status    EventStatus // active / stub / deprec
	Note      string      // optional one-liner; surfaced in generated TS JSDoc
}

// Catalog is populated by init() in each envelope_catalog_*.go file.
// Consumers MUST NOT mutate after package init completes.
var Catalog []EventDef

// RegisterCatalog appends defs into the package-level Catalog.
// Intended for init() use only. Panics on obviously broken entries so that
// a malformed Catalog is surfaced at server boot rather than at runtime:
//   - empty Type
//   - DirUnknown direction
//   - duplicate Type (first registration wins; the duplicate surfaces the
//     previous Direction/Category in the panic message to help diagnose
//     copy-paste errors across envelope_catalog_*.go files)
func RegisterCatalog(defs ...EventDef) {
	for _, d := range defs {
		if d.Type == "" {
			panic("ws.Catalog: empty Type")
		}
		if d.Direction == DirUnknown {
			panic("ws.Catalog: direction required for " + d.Type)
		}
		for _, existing := range Catalog {
			if existing.Type == d.Type {
				panic("ws.Catalog: duplicate Type " + d.Type +
					" (first registered as " + existing.Direction.String() +
					"/" + existing.Category + ")")
			}
		}
		Catalog = append(Catalog, d)
	}
}

// BootstrapRegistry registers all module-namespaced C2S and Bidi entries
// from Catalog into r, using a pass-through decoder. Called once from
// main.go before the Hub begins accepting connections. The pass-through is
// intentional — the session actor and module handlers perform their own
// typed decode; the registry only prevents unknown-type drops at Hub.Route.
//
// The following entries are deliberately skipped:
//   - S2C-only (never client-incoming).
//   - StatusStub (unimplemented; keeps accidental pass-through from masking
//     missing handlers, e.g. auth.* reserved for PR-9).
//   - Category "system" (ping/pong/error/connected/reconnect are served
//     upstream of the registry via the Router's system-type fast path).
func BootstrapRegistry(r *EnvelopeRegistry) {
	passThrough := func(raw json.RawMessage) (any, error) { return raw, nil }
	for _, d := range Catalog {
		if d.Status == StatusStub {
			continue
		}
		if d.Direction == DirS2C {
			continue
		}
		if d.Category == "system" {
			continue
		}
		r.Register(d.Type, passThrough)
	}
}

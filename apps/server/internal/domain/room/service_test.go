package room

import (
	"errors"
	"net/http"
	"testing"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

// TestResolveMaxPlayers_TableDriven exercises the boundary matrix for the
// CreateRoom MaxPlayers fallback + range validation helper.
//
// The theme used in every case below has [MinPlayers=4, MaxPlayers=8].
// Cases (per PR-1 spec):
//   - min-1 (3)  → VALIDATION_ERROR
//   - min   (4)  → OK, no fallback
//   - max   (8)  → OK, no fallback
//   - max+1 (9)  → VALIDATION_ERROR
//   - nil        → theme default (8), fallback=true
func TestResolveMaxPlayers_TableDriven(t *testing.T) {
	t.Parallel()

	theme := db.Theme{MinPlayers: 4, MaxPlayers: 8}

	int32p := func(v int32) *int32 { return &v }

	cases := []struct {
		name         string
		req          *int32
		wantValue    int32
		wantFallback bool
		wantErr      bool
	}{
		{name: "min-1 (below theme min)", req: int32p(3), wantErr: true},
		{name: "min (theme lower bound)", req: int32p(4), wantValue: 4, wantFallback: false},
		{name: "mid (within range)", req: int32p(6), wantValue: 6, wantFallback: false},
		{name: "max (theme upper bound)", req: int32p(8), wantValue: 8, wantFallback: false},
		{name: "max+1 (above theme max)", req: int32p(9), wantErr: true},
		{name: "nil (theme default fallback)", req: nil, wantValue: 8, wantFallback: true},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, fallback, err := resolveMaxPlayers(theme, tc.req)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got value=%d fallback=%v", got, fallback)
				}
				var ae *apperror.AppError
				if !errors.As(err, &ae) {
					t.Fatalf("expected *apperror.AppError, got %T", err)
				}
				if ae.Code != apperror.ErrValidation {
					t.Errorf("error code: got %q, want %q", ae.Code, apperror.ErrValidation)
				}
				if ae.Status != http.StatusBadRequest {
					t.Errorf("http status: got %d, want %d", ae.Status, http.StatusBadRequest)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.wantValue {
				t.Errorf("value: got %d, want %d", got, tc.wantValue)
			}
			if fallback != tc.wantFallback {
				t.Errorf("fallback: got %v, want %v", fallback, tc.wantFallback)
			}
		})
	}
}

// TestResolveMaxPlayers_NarrowThemeRange verifies the helper handles a theme
// whose [Min, Max] range collapses to a single value (e.g. solo-host themes).
func TestResolveMaxPlayers_NarrowThemeRange(t *testing.T) {
	t.Parallel()

	theme := db.Theme{MinPlayers: 5, MaxPlayers: 5}

	// Exactly 5 is the only valid request value.
	v := int32(5)
	got, fallback, err := resolveMaxPlayers(theme, &v)
	if err != nil {
		t.Fatalf("expected OK for exact match, got %v", err)
	}
	if got != 5 || fallback {
		t.Errorf("value=%d fallback=%v, want value=5 fallback=false", got, fallback)
	}

	// 4 is below; 6 is above.
	for _, bad := range []int32{4, 6} {
		_, _, err := resolveMaxPlayers(theme, &bad)
		if err == nil {
			t.Errorf("expected error for bad=%d, got nil", bad)
		}
	}

	// nil → fallback to 5.
	got, fallback, err = resolveMaxPlayers(theme, nil)
	if err != nil {
		t.Fatalf("nil request: unexpected error %v", err)
	}
	if got != 5 || !fallback {
		t.Errorf("nil request: value=%d fallback=%v, want value=5 fallback=true", got, fallback)
	}
}

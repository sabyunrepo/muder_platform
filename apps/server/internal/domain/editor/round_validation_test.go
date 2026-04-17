package editor

import (
	"strings"
	"testing"

	"github.com/mmp-platform/server/internal/apperror"
)

func p(v int32) *int32 { return &v }

func TestValidateClueRoundOrder(t *testing.T) {
	cases := []struct {
		name    string
		reveal  *int32
		hide    *int32
		wantErr bool
	}{
		{"both nil", nil, nil, false},
		{"only reveal", p(2), nil, false},
		{"only hide", nil, p(5), false},
		{"reveal < hide", p(2), p(5), false},
		{"reveal == hide", p(3), p(3), false},
		{"reveal > hide", p(5), p(2), true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateClueRoundOrder(tc.reveal, tc.hide)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				if !strings.Contains(err.Error(), "reveal_round") {
					t.Fatalf("expected reveal_round in error, got %v", err)
				}
				ae, ok := err.(*apperror.AppError)
				if !ok || ae.Status != 400 {
					t.Fatalf("expected 400 AppError, got %T %v", err, err)
				}
			} else if err != nil {
				t.Fatalf("expected nil error, got %v", err)
			}
		})
	}
}

func TestValidateLocationRoundOrder(t *testing.T) {
	cases := []struct {
		name    string
		from    *int32
		until   *int32
		wantErr bool
	}{
		{"both nil", nil, nil, false},
		{"only from", p(1), nil, false},
		{"only until", nil, p(4), false},
		{"from < until", p(1), p(4), false},
		{"from == until", p(2), p(2), false},
		{"from > until", p(5), p(2), true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateLocationRoundOrder(tc.from, tc.until)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				if !strings.Contains(err.Error(), "from_round") {
					t.Fatalf("expected from_round in error, got %v", err)
				}
			} else if err != nil {
				t.Fatalf("expected nil error, got %v", err)
			}
		})
	}
}

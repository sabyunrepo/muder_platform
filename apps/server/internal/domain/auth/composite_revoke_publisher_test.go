package auth

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
)

// fakeRevokePublisher records every call and optionally returns a fixed
// error. Tests use the err field to drive failure scenarios.
type fakeRevokePublisher struct {
	name      string
	err       error
	userCalls int
	sessCalls int
	tokCalls  int
}

func (f *fakeRevokePublisher) RevokeUser(_ context.Context, _ uuid.UUID, _, _ string) error {
	f.userCalls++
	return f.err
}

func (f *fakeRevokePublisher) RevokeSession(_ context.Context, _ uuid.UUID, _, _ string) error {
	f.sessCalls++
	return f.err
}

func (f *fakeRevokePublisher) RevokeToken(_ context.Context, _, _, _ string) error {
	f.tokCalls++
	return f.err
}

func TestCompositeRevokePublisher_AllSucceed_NoError(t *testing.T) {
	t.Parallel()
	a := &fakeRevokePublisher{name: "a"}
	b := &fakeRevokePublisher{name: "b"}
	c := NewCompositeRevokePublisher(a, b)

	if err := c.RevokeUser(context.Background(), uuid.New(), "code", "reason"); err != nil {
		t.Fatalf("RevokeUser: unexpected error %v", err)
	}
	if a.userCalls != 1 || b.userCalls != 1 {
		t.Errorf("expected each publisher called once, got a=%d b=%d", a.userCalls, b.userCalls)
	}
}

// Regression for H-3: prior implementation returned only the first
// publisher's error. The Join wrapper must surface every failure so a
// silent partial outage in the second hub is observable.
func TestCompositeRevokePublisher_AllFail_JoinsEveryError(t *testing.T) {
	t.Parallel()
	errA := errors.New("hub a down")
	errB := errors.New("hub b down")
	a := &fakeRevokePublisher{name: "a", err: errA}
	b := &fakeRevokePublisher{name: "b", err: errB}
	c := NewCompositeRevokePublisher(a, b)

	err := c.RevokeUser(context.Background(), uuid.New(), "code", "reason")
	if err == nil {
		t.Fatal("expected error when both publishers fail")
	}
	if !errors.Is(err, errA) {
		t.Errorf("errors.Is(err, errA)=false; err=%v", err)
	}
	if !errors.Is(err, errB) {
		t.Errorf("errors.Is(err, errB)=false; err=%v (silent in old firstErr-only impl)", err)
	}
	// Both publishers must have been invoked even after the first failure.
	if a.userCalls != 1 || b.userCalls != 1 {
		t.Errorf("expected each publisher called once even on error, got a=%d b=%d", a.userCalls, b.userCalls)
	}
}

func TestCompositeRevokePublisher_PartialFailure_JoinsAndContinues(t *testing.T) {
	t.Parallel()
	errA := errors.New("hub a down")
	a := &fakeRevokePublisher{name: "a", err: errA}
	b := &fakeRevokePublisher{name: "b"} // healthy
	c := NewCompositeRevokePublisher(a, b)

	err := c.RevokeSession(context.Background(), uuid.New(), "code", "reason")
	if err == nil {
		t.Fatal("expected error from failing publisher")
	}
	if !errors.Is(err, errA) {
		t.Errorf("errors.Is(err, errA)=false; err=%v", err)
	}
	if a.sessCalls != 1 || b.sessCalls != 1 {
		t.Errorf("expected each publisher called once, got a=%d b=%d", a.sessCalls, b.sessCalls)
	}
}

func TestCompositeRevokePublisher_NilEntriesFiltered(t *testing.T) {
	t.Parallel()
	a := &fakeRevokePublisher{name: "a"}
	c := NewCompositeRevokePublisher(a, nil, nil)

	if err := c.RevokeToken(context.Background(), "jti", "code", "reason"); err != nil {
		t.Fatalf("RevokeToken: unexpected error %v", err)
	}
	if a.tokCalls != 1 {
		t.Errorf("expected a called once, got %d", a.tokCalls)
	}
}

func TestCompositeRevokePublisher_EmptyIsNoop(t *testing.T) {
	t.Parallel()
	c := NewCompositeRevokePublisher()
	if err := c.RevokeUser(context.Background(), uuid.New(), "code", "reason"); err != nil {
		t.Errorf("empty composite RevokeUser: %v", err)
	}
	if err := c.RevokeSession(context.Background(), uuid.New(), "code", "reason"); err != nil {
		t.Errorf("empty composite RevokeSession: %v", err)
	}
	if err := c.RevokeToken(context.Background(), "jti", "code", "reason"); err != nil {
		t.Errorf("empty composite RevokeToken: %v", err)
	}
}

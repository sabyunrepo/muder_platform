package auditlog

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib" // pgx stdlib driver for database/sql used by goose
	"github.com/pressly/goose/v3"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

// ---------------------------------------------------------------------------
// Test fixture
// ---------------------------------------------------------------------------

// migrationsDir returns the absolute path to db/migrations.
// Go test binaries run with cwd = package directory (internal/auditlog),
// so ../../db/migrations resolves to apps/server/db/migrations.
func migrationsDir() string {
	abs, err := filepath.Abs("../../db/migrations")
	if err != nil {
		panic("migrationsDir: " + err.Error())
	}
	return abs
}

// setupStore starts a PostgreSQL container, runs all goose migrations, and
// returns a ready Store. The container is terminated at test cleanup.
func setupStore(t *testing.T) *Store {
	t.Helper()
	ctx := context.Background()

	pgC, err := postgres.Run(ctx,
		"postgres:16-alpine",
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2),
		),
	)
	if err != nil {
		t.Fatalf("failed to start postgres container: %v", err)
	}
	t.Cleanup(func() {
		if err := pgC.Terminate(ctx); err != nil {
			t.Logf("failed to terminate postgres container: %v", err)
		}
	})

	connStr, err := pgC.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("failed to get connection string: %v", err)
	}

	// Run migrations via goose using the pgx stdlib driver.
	sqlDB, err := sql.Open("pgx", connStr)
	if err != nil {
		t.Fatalf("failed to open sql.DB: %v", err)
	}
	defer sqlDB.Close()

	goose.SetBaseFS(nil)
	if err := goose.SetDialect("postgres"); err != nil {
		t.Fatalf("goose.SetDialect: %v", err)
	}
	if err := goose.Up(sqlDB, migrationsDir()); err != nil {
		t.Fatalf("goose.Up: %v", err)
	}

	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		t.Fatalf("failed to create pgxpool: %v", err)
	}
	t.Cleanup(pool.Close)

	return NewStore(pool)
}

func makeEvent(sessionID uuid.UUID, action AuditAction) AuditEvent {
	return AuditEvent{
		SessionID: sessionID,
		Action:    action,
		Payload:   json.RawMessage(`{}`),
	}
}

// ---------------------------------------------------------------------------
// Unit tests (no container needed)
// ---------------------------------------------------------------------------

func TestNewStore_NilPanic(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("expected panic for nil pool, got none")
		}
	}()
	NewStore(nil)
}

func TestAuditEvent_Validate_Errors(t *testing.T) {
	// zero session_id
	err := (AuditEvent{Action: ActionPhaseEnter}).Validate()
	if err == nil {
		t.Fatal("expected error for zero session_id")
	}
	// empty action
	err = (AuditEvent{SessionID: uuid.New()}).Validate()
	if err == nil {
		t.Fatal("expected error for empty action")
	}
}

// ---------------------------------------------------------------------------
// Integration tests (testcontainers)
// ---------------------------------------------------------------------------

func TestStore_Append_HappyPath(t *testing.T) {
	store := setupStore(t)
	ctx := context.Background()
	sid := uuid.New()

	evt := makeEvent(sid, ActionPhaseEnter)
	if err := store.Append(ctx, evt); err != nil {
		t.Fatalf("Append failed: %v", err)
	}

	events, err := store.ListBySession(ctx, sid)
	if err != nil {
		t.Fatalf("ListBySession failed: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}
	if events[0].Seq != 1 {
		t.Errorf("expected seq=1, got %d", events[0].Seq)
	}
	if events[0].Action != ActionPhaseEnter {
		t.Errorf("expected action=%s, got %s", ActionPhaseEnter, events[0].Action)
	}
}

func TestStore_Append_WithActorAndModule(t *testing.T) {
	store := setupStore(t)
	ctx := context.Background()
	sid := uuid.New()
	actor := uuid.New()

	evt := AuditEvent{
		SessionID: sid,
		ActorID:   &actor,
		Action:    ActionRuleEval,
		ModuleID:  "decision.voting",
		Payload:   json.RawMessage(`{"vote":"guilty"}`),
	}
	if err := store.Append(ctx, evt); err != nil {
		t.Fatalf("Append failed: %v", err)
	}

	events, err := store.ListBySession(ctx, sid)
	if err != nil {
		t.Fatalf("ListBySession failed: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}
	got := events[0]
	if got.ActorID == nil || *got.ActorID != actor {
		t.Errorf("ActorID mismatch: got %v, want %v", got.ActorID, actor)
	}
	if got.ModuleID != "decision.voting" {
		t.Errorf("ModuleID mismatch: got %q, want %q", got.ModuleID, "decision.voting")
	}
}

func TestStore_ListBySession_Ordering(t *testing.T) {
	store := setupStore(t)
	ctx := context.Background()
	sid := uuid.New()

	actions := []AuditAction{ActionPhaseEnter, ActionPlayerAction, ActionPhaseExit, ActionWinDecision}
	for _, a := range actions {
		if err := store.Append(ctx, makeEvent(sid, a)); err != nil {
			t.Fatalf("Append(%s) failed: %v", a, err)
		}
	}

	events, err := store.ListBySession(ctx, sid)
	if err != nil {
		t.Fatalf("ListBySession failed: %v", err)
	}
	if len(events) != len(actions) {
		t.Fatalf("expected %d events, got %d", len(actions), len(events))
	}
	for i, e := range events {
		if e.Seq != int64(i+1) {
			t.Errorf("events[%d]: expected seq=%d, got %d", i, i+1, e.Seq)
		}
		if e.Action != actions[i] {
			t.Errorf("events[%d]: expected action=%s, got %s", i, actions[i], e.Action)
		}
	}
}

func TestStore_LatestSeq_Empty(t *testing.T) {
	store := setupStore(t)
	ctx := context.Background()
	sid := uuid.New()

	seq, err := store.LatestSeq(ctx, sid)
	if err != nil {
		t.Fatalf("LatestSeq failed: %v", err)
	}
	if seq != 0 {
		t.Errorf("expected 0 for empty session, got %d", seq)
	}
}

func TestStore_ConcurrentAppend_SeqUniqueness(t *testing.T) {
	store := setupStore(t)
	ctx := context.Background()
	sid := uuid.New()

	const goroutines = 100
	var wg sync.WaitGroup
	var errCount atomic.Int64

	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		go func(n int) {
			defer wg.Done()
			evt := AuditEvent{
				SessionID: sid,
				Action:    ActionPlayerAction,
				Payload:   json.RawMessage(fmt.Sprintf(`{"i":%d}`, n)),
			}
			if err := store.Append(ctx, evt); err != nil {
				errCount.Add(1)
				t.Logf("Append goroutine %d error: %v", n, err)
			}
		}(i)
	}
	wg.Wait()

	if errCount.Load() > 0 {
		t.Fatalf("%d out of %d concurrent appends failed", errCount.Load(), goroutines)
	}

	events, err := store.ListBySession(ctx, sid)
	if err != nil {
		t.Fatalf("ListBySession failed: %v", err)
	}
	if int64(len(events)) != goroutines {
		t.Fatalf("expected %d events, got %d", goroutines, len(events))
	}

	// Verify all seq values are unique and contiguous 1..goroutines.
	seqs := make(map[int64]bool, goroutines)
	for _, e := range events {
		if seqs[e.Seq] {
			t.Errorf("duplicate seq %d found", e.Seq)
		}
		seqs[e.Seq] = true
	}
	for i := int64(1); i <= goroutines; i++ {
		if !seqs[i] {
			t.Errorf("missing seq %d", i)
		}
	}
}

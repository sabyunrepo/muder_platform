package postgrestest

import (
	"context"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go/modules/postgres"
)

const image = "public.ecr.aws/docker/library/postgres:16-alpine"

// Start returns a test PostgreSQL connection string and registers container
// cleanup. BasicWaitStrategies waits for both database readiness and the Docker
// host port proxy, avoiding flaky mapped-port lookups on macOS.
func Start(ctx context.Context, t testing.TB) string {
	t.Helper()

	pgC, err := postgres.Run(ctx, image, postgres.BasicWaitStrategies())
	if err != nil {
		t.Fatalf("start postgres container: %v", err)
	}
	t.Cleanup(func() {
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := pgC.Terminate(cleanupCtx); err != nil {
			t.Logf("terminate postgres container: %v", err)
		}
	})

	connStr, err := pgC.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("connection string: %v", err)
	}
	return connStr
}

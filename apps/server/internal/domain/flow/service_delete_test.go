package flow

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/rs/zerolog"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/mmp-platform/server/internal/apperror"
)

func TestServiceDeleteNode_CleansEndingBranchReferencesAndCascadesEdges(t *testing.T) {
	ctx := context.Background()
	pool := setupFlowTestPool(t)
	svc := NewService(pool, zerolog.Nop())
	creatorID := insertFlowTestUser(t, pool)
	themeID := insertFlowTestTheme(t, pool, creatorID, json.RawMessage(`{}`))

	deletedEnding, err := svc.CreateNode(ctx, creatorID, themeID, CreateNodeRequest{
		Type:      NodeTypeEnding,
		Data:      json.RawMessage(`{"label":"삭제 결말"}`),
		PositionX: 100,
		PositionY: 100,
	})
	if err != nil {
		t.Fatalf("CreateNode deleted ending: %v", err)
	}
	keptEnding, err := svc.CreateNode(ctx, creatorID, themeID, CreateNodeRequest{
		Type:      NodeTypeEnding,
		Data:      json.RawMessage(`{"label":"남길 결말"}`),
		PositionX: 300,
		PositionY: 100,
	})
	if err != nil {
		t.Fatalf("CreateNode kept ending: %v", err)
	}
	edge, err := svc.CreateEdge(ctx, creatorID, themeID, CreateEdgeRequest{
		SourceID:  keptEnding.ID,
		TargetID:  deletedEnding.ID,
		Condition: json.RawMessage(`{"id":"group-1","operator":"AND","rules":[{"id":"rule-1","variable":"custom_flag","target_flag_key":"cleanup_test","comparator":"=","value":"true"}]}`),
		SortOrder: 1,
	})
	if err != nil {
		t.Fatalf("CreateEdge: %v", err)
	}

	config := json.RawMessage(fmt.Sprintf(`{
		"modules": {
			"ending_branch": {
				"enabled": true,
				"config": {
					"defaultEnding": "%s",
					"matrix": [
						{"priority": 1, "ending": "%s", "condition": {"var": "deleted"}},
						{"priority": 2, "ending": "%s", "condition": {"var": "kept"}}
					],
					"questions": [{"id": "q1"}]
				}
			}
		}
	}`, deletedEnding.ID, deletedEnding.ID, keptEnding.ID))
	if _, err := pool.Exec(ctx, `UPDATE themes SET config_json=$2 WHERE id=$1`, themeID, config); err != nil {
		t.Fatalf("seed config_json: %v", err)
	}

	if err := svc.DeleteNode(ctx, creatorID, themeID, deletedEnding.ID); err != nil {
		t.Fatalf("DeleteNode: %v", err)
	}

	var nodeCount int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM flow_nodes WHERE id=$1`, deletedEnding.ID).Scan(&nodeCount); err != nil {
		t.Fatalf("count deleted node: %v", err)
	}
	if nodeCount != 0 {
		t.Fatalf("deleted ending node should be gone, got %d rows", nodeCount)
	}
	var edgeCount int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM flow_edges WHERE id=$1`, edge.ID).Scan(&edgeCount); err != nil {
		t.Fatalf("count cascaded edge: %v", err)
	}
	if edgeCount != 0 {
		t.Fatalf("edge pointing to deleted ending should cascade, got %d rows", edgeCount)
	}

	var cleaned json.RawMessage
	if err := pool.QueryRow(ctx, `SELECT config_json FROM themes WHERE id=$1`, themeID).Scan(&cleaned); err != nil {
		t.Fatalf("load cleaned config: %v", err)
	}
	decoded := mustDecodeJSON(t, cleaned)
	if endingBranchConfigContains(decoded, deletedEnding.ID.String()) {
		t.Fatalf("deleted ending id still present in ending_branch config: %s", string(cleaned))
	}
	if !endingBranchConfigContains(decoded, keptEnding.ID.String()) {
		t.Fatalf("kept ending id was removed from ending_branch config: %s", string(cleaned))
	}
}

func TestServiceDeleteNode_RejectsDifferentCreator(t *testing.T) {
	ctx := context.Background()
	pool := setupFlowTestPool(t)
	svc := NewService(pool, zerolog.Nop())
	ownerID := insertFlowTestUser(t, pool)
	otherCreatorID := insertFlowTestUser(t, pool)
	themeID := insertFlowTestTheme(t, pool, ownerID, json.RawMessage(`{}`))
	node, err := svc.CreateNode(ctx, ownerID, themeID, CreateNodeRequest{
		Type:      NodeTypeEnding,
		Data:      json.RawMessage(`{}`),
		PositionX: 0,
		PositionY: 0,
	})
	if err != nil {
		t.Fatalf("CreateNode: %v", err)
	}

	err = svc.DeleteNode(ctx, otherCreatorID, themeID, node.ID)
	if err == nil {
		t.Fatal("expected DeleteNode to reject a different creator")
	}
	appErr, ok := err.(*apperror.AppError)
	if !ok || appErr.Code != apperror.ErrNotFound {
		t.Fatalf("expected not found app error, got %#v", err)
	}

	var nodeCount int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM flow_nodes WHERE id=$1`, node.ID).Scan(&nodeCount); err != nil {
		t.Fatalf("count node after rejected delete: %v", err)
	}
	if nodeCount != 1 {
		t.Fatalf("node should remain after rejected delete, got %d rows", nodeCount)
	}
}

func TestServiceDeleteNode_RejectsDifferentThemeOwnedBySameCreator(t *testing.T) {
	ctx := context.Background()
	pool := setupFlowTestPool(t)
	svc := NewService(pool, zerolog.Nop())
	creatorID := insertFlowTestUser(t, pool)
	themeAID := insertFlowTestTheme(t, pool, creatorID, json.RawMessage(`{}`))
	themeBID := insertFlowTestTheme(t, pool, creatorID, json.RawMessage(`{}`))
	node, err := svc.CreateNode(ctx, creatorID, themeBID, CreateNodeRequest{
		Type:      NodeTypeEnding,
		Data:      json.RawMessage(`{}`),
		PositionX: 0,
		PositionY: 0,
	})
	if err != nil {
		t.Fatalf("CreateNode: %v", err)
	}

	err = svc.DeleteNode(ctx, creatorID, themeAID, node.ID)
	if err == nil {
		t.Fatal("expected DeleteNode to reject a node from a different theme")
	}
	appErr, ok := err.(*apperror.AppError)
	if !ok || appErr.Code != apperror.ErrNotFound {
		t.Fatalf("expected not found app error, got %#v", err)
	}

	var nodeCount int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM flow_nodes WHERE id=$1`, node.ID).Scan(&nodeCount); err != nil {
		t.Fatalf("count node after rejected delete: %v", err)
	}
	if nodeCount != 1 {
		t.Fatalf("node should remain after rejected cross-theme delete, got %d rows", nodeCount)
	}
}

func setupFlowTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	ctx := context.Background()
	pgC, err := postgres.Run(ctx,
		"public.ecr.aws/docker/library/postgres:16-alpine",
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2),
		),
	)
	if err != nil {
		t.Fatalf("start postgres container: %v", err)
	}
	t.Cleanup(func() {
		if err := pgC.Terminate(ctx); err != nil {
			t.Logf("terminate container: %v", err)
		}
	})

	connStr, err := pgC.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("connection string: %v", err)
	}

	sqlDB, err := sql.Open("pgx", connStr)
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	defer sqlDB.Close()

	goose.SetBaseFS(nil)
	if err := goose.SetDialect("postgres"); err != nil {
		t.Fatalf("goose.SetDialect: %v", err)
	}
	if err := goose.Up(sqlDB, flowMigrationsPath()); err != nil {
		t.Fatalf("goose.Up: %v", err)
	}

	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func flowMigrationsPath() string {
	abs, err := filepath.Abs("../../../db/migrations")
	if err != nil {
		panic("flowMigrationsPath: " + err.Error())
	}
	return abs
}

func insertFlowTestUser(t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	if err := pool.QueryRow(context.Background(), `
		INSERT INTO users (nickname, email, provider, provider_id)
		VALUES ($1, $2, 'local', $3)
		RETURNING id
	`, "tester-"+uuid.New().String()[:8], "tester-"+uuid.New().String()[:8]+"@example.com", uuid.New().String()).Scan(&id); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	return id
}

func insertFlowTestTheme(t *testing.T, pool *pgxpool.Pool, creatorID uuid.UUID, config json.RawMessage) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	if err := pool.QueryRow(context.Background(), `
		INSERT INTO themes (creator_id, title, slug, min_players, max_players, duration_min, config_json)
		VALUES ($1, 'Flow Test Theme', $2, 2, 6, 60, $3)
		RETURNING id
	`, creatorID, "flow-test-"+uuid.New().String()[:8], config).Scan(&id); err != nil {
		t.Fatalf("insert theme: %v", err)
	}
	return id
}

func endingBranchConfigContains(value any, target string) bool {
	root, ok := value.(map[string]any)
	if !ok {
		return false
	}
	modules, ok := root["modules"].(map[string]any)
	if !ok {
		return false
	}
	endingBranch, ok := modules["ending_branch"].(map[string]any)
	if !ok {
		return false
	}
	return jsonValueContainsStringOrKey(endingBranch, target)
}

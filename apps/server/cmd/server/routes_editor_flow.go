package main

import "github.com/go-chi/chi/v5"

// registerEditorFlowRoutes wires the flow-canvas (game flow graph) endpoints
// onto an existing /editor subrouter.
func registerEditorFlowRoutes(r chi.Router, deps authedDeps) {
	r.Get("/themes/{id}/flow", deps.flow.GetFlow)
	r.Put("/themes/{id}/flow", deps.flow.SaveFlow)

	r.Post("/themes/{id}/flow/nodes", deps.flow.CreateNode)
	r.Patch("/themes/{id}/flow/nodes/{nodeId}", deps.flow.UpdateNode)
	r.Delete("/themes/{id}/flow/nodes/{nodeId}", deps.flow.DeleteNode)

	r.Post("/themes/{id}/flow/edges", deps.flow.CreateEdge)
	r.Patch("/themes/{id}/flow/edges/{edgeId}", deps.flow.UpdateEdge)
	r.Delete("/themes/{id}/flow/edges/{edgeId}", deps.flow.DeleteEdge)

	r.Post("/themes/{id}/flow/migrate", deps.flow.MigrateFlow)
}

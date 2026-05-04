package flow

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/apperror"
)

func TestValidateEdgeCondition_AcceptsSharedConditionContract(t *testing.T) {
	condition := json.RawMessage(`{
		"id":"group-1",
		"operator":"AND",
		"rules":[
			{"id":"rule-1","variable":"custom_flag","target_flag_key":"manual_override","comparator":"=","value":"true"}
		]
	}`)
	if err := ValidateEdgeCondition(condition); err != nil {
		t.Fatalf("ValidateEdgeCondition: %v", err)
	}
}

func TestValidateEdgeCondition_RejectsInvalidCondition(t *testing.T) {
	err := ValidateEdgeCondition(json.RawMessage(`{
		"id":"group-1",
		"operator":"AND",
		"rules":[
			{"id":"rule-1","variable":"raw_engine_key","comparator":"=","value":"x"}
		]
	}`))
	if err == nil {
		t.Fatal("expected validation error")
	}
	appErr, ok := err.(*apperror.AppError)
	if !ok {
		t.Fatalf("expected AppError, got %T", err)
	}
	if appErr.Status != 400 {
		t.Fatalf("expected 400, got %d", appErr.Status)
	}
}

func TestValidateSaveRequest_ValidatesEdgeCondition(t *testing.T) {
	startID := uuid.New()
	endingID := uuid.New()
	req := SaveFlowRequest{
		Nodes: []FlowNodeInput{
			{ID: &startID, Type: NodeTypeStart},
			{ID: &endingID, Type: NodeTypeEnding},
		},
		Edges: []FlowEdgeInput{{
			SourceID:  startID,
			TargetID:  endingID,
			Condition: json.RawMessage(`{"id":"group-1","operator":"OR","rules":[]}`),
		}},
	}
	if err := validateSaveRequest(req); err == nil {
		t.Fatal("expected invalid condition error")
	}
}

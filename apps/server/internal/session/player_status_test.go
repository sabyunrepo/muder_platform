package session

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
	"github.com/rs/zerolog"
)

func TestSessionPlayerStatusController_UpdatesLiveRosterAndPublishesEvent(t *testing.T) {
	sessionID := uuid.New()
	actorID := uuid.New()
	targetID := uuid.New()
	bus := engine.NewEventBus(nil)
	eng := engine.NewPhaseEngine(
		sessionID,
		nil,
		bus,
		nil,
		nil,
		[]engine.PhaseDefinition{{ID: engine.Phase("intro"), Name: "Intro"}},
	)
	s := newSession(sessionID, eng, []PlayerState{
		{PlayerID: actorID, TargetCode: "actor"},
		{PlayerID: targetID, TargetCode: "target"},
	}, zerolog.Nop())

	var statusEvent map[string]any
	bus.Subscribe("player.status_changed", func(e engine.Event) {
		statusEvent = e.Payload.(map[string]any)
	})
	info, err := s.ApplyPlayerStatus(context.Background(), engine.PlayerStatusAction{
		ActorID:  actorID,
		TargetID: targetID,
		IsAlive:  false,
		Reason:   "clue_kill_effect",
		Source:   "clue_interaction",
		ClueID:   uuid.New(),
	})
	if err != nil {
		t.Fatalf("ApplyPlayerStatus: %v", err)
	}
	if info.PlayerID != targetID || info.IsAlive {
		t.Fatalf("updated info = %+v, want target dead", info)
	}
	liveInfo, ok := s.PlayerRuntimeInfo(context.Background(), targetID)
	if !ok || liveInfo.IsAlive {
		t.Fatalf("PlayerRuntimeInfo(target) = (%+v, %v), want dead", liveInfo, ok)
	}
	if !s.dirty {
		t.Fatal("ApplyPlayerStatus should mark session dirty")
	}
	if statusEvent["actorId"] != actorID.String() || statusEvent["playerId"] != targetID.String() || statusEvent["isAlive"] != false {
		t.Fatalf("player.status_changed payload mismatch: %+v", statusEvent)
	}
}

func TestSessionPlayerStatusController_RejectsDeadActorAndDeadTarget(t *testing.T) {
	sessionID := uuid.New()
	actorID := uuid.New()
	targetID := uuid.New()
	dead := false
	eng := engine.NewPhaseEngine(
		sessionID,
		nil,
		engine.NewEventBus(nil),
		nil,
		nil,
		[]engine.PhaseDefinition{{ID: engine.Phase("intro"), Name: "Intro"}},
	)
	s := newSession(sessionID, eng, []PlayerState{
		{PlayerID: actorID, IsAlive: &dead},
		{PlayerID: targetID},
	}, zerolog.Nop())

	if _, err := s.ApplyPlayerStatus(context.Background(), engine.PlayerStatusAction{
		ActorID:  actorID,
		TargetID: targetID,
		IsAlive:  false,
	}); err == nil {
		t.Fatal("expected dead actor to be rejected")
	}

	alive := true
	s.players[actorID].IsAlive = &alive
	s.players[targetID].IsAlive = &dead
	if _, err := s.ApplyPlayerStatus(context.Background(), engine.PlayerStatusAction{
		ActorID:  actorID,
		TargetID: targetID,
		IsAlive:  false,
	}); err == nil {
		t.Fatal("expected already-dead target to be rejected")
	}
}

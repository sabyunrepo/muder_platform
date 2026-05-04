package main

import "testing"

func TestModuleNameForMessageType_EventTrigger(t *testing.T) {
	if got := moduleNameForMessageType("event:trigger"); got != "event_progression" {
		t.Fatalf("moduleNameForMessageType(event:trigger) = %q, want event_progression", got)
	}
}

func TestModuleNameForMessageType_PreservesUnknownMessages(t *testing.T) {
	if got := moduleNameForMessageType("game:vote"); got != "" {
		t.Fatalf("moduleNameForMessageType(game:vote) = %q, want empty fallback", got)
	}
}

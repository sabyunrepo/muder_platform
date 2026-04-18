package reading

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/engine"
)

// HandleVoiceEnded is the server-trusted advance entry point for lines whose
// effective advanceBy is "voice". It bypasses the player/host permission
// check because the server itself is the source of truth for media end.
// On non-voice lines this is a no-op (the timing race between client-reported
// voice end and a player advance is resolved in the player's favor).
//
// voiceID is validated against the current line's expected voice id to
// prevent stale-race exploits. Empty voiceID is accepted for backward
// compatibility with clients that don't track media ids; a mismatched
// non-empty voiceID is silently ignored (the legitimate late voice_ended of
// a previous line can race against a manual advance, so this must not
// surface as an error).
func (m *ReadingModule) HandleVoiceEnded(ctx context.Context, voiceID string) error {
	m.mu.Lock()
	if !m.isActive {
		m.mu.Unlock()
		return nil
	}
	if m.totalLines <= 0 || m.currentLineIndex < 0 || m.currentLineIndex >= m.totalLines {
		m.mu.Unlock()
		return nil
	}
	advanceBy := m.resolveAdvanceBy(m.currentLineIndex)
	if advanceBy != "voice" {
		// Non-voice line: ignore stale voice_ended events. This handles the
		// case where a player manually advanced past a voice line just as
		// the media completed on the client.
		m.mu.Unlock()
		return nil
	}
	// Stale-race guard: when the client reports a voice id, it must match
	// the current line's expected voice id. Empty id from the client is
	// accepted for backward compatibility.
	if voiceID != "" {
		expected := m.lines[m.currentLineIndex].VoiceMediaID
		if expected == "" {
			expected = m.lines[m.currentLineIndex].VoiceID
		}
		if expected != "" && expected != voiceID {
			m.mu.Unlock()
			return nil
		}
	}

	// Perform the advance under the held lock (mirrors HandleAdvance).
	if m.currentLineIndex >= m.totalLines-1 {
		m.isActive = false
		totalLines := m.totalLines
		m.mu.Unlock()
		m.deps.EventBus.Publish(engine.Event{
			Type:    "reading.completed",
			Payload: map[string]any{"totalLines": totalLines},
		})
		return nil
	}
	m.currentLineIndex++
	lineIndex := m.currentLineIndex
	totalLines := m.totalLines
	nextVoiceID := m.resolveVoiceID(lineIndex)
	completed := m.currentLineIndex >= m.totalLines-1
	if completed {
		m.isActive = false
	}
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "reading.line_changed",
		Payload: map[string]any{
			"lineIndex":  lineIndex,
			"totalLines": totalLines,
			"voiceId":    nextVoiceID,
		},
	})
	if completed {
		m.deps.EventBus.Publish(engine.Event{
			Type:    "reading.completed",
			Payload: map[string]any{"totalLines": totalLines},
		})
	}
	return nil
}

// HandleAdvance validates that the caller is allowed to advance the current
// reading line, and on success advances to the next line (publishing
// reading.line_changed / reading.completed events). The caller must resolve
// host status and the player's role id from the session before calling.
//
// Returns *apperror.AppError on permission/state errors.
func (m *ReadingModule) HandleAdvance(ctx context.Context, playerID uuid.UUID, isHost bool, roleID string) error {
	m.mu.Lock()
	if !m.isActive {
		m.mu.Unlock()
		return apperror.New(apperror.ErrReadingLineOutOfRange, http.StatusNotFound, "reading: module not active")
	}
	if m.totalLines <= 0 || m.currentLineIndex < 0 || m.currentLineIndex >= m.totalLines {
		m.mu.Unlock()
		return apperror.New(apperror.ErrReadingLineOutOfRange, http.StatusNotFound, "reading: no current line")
	}

	advanceBy := m.resolveAdvanceBy(m.currentLineIndex)
	if !validAdvanceBy(advanceBy) {
		m.mu.Unlock()
		return apperror.New(apperror.ErrReadingInvalidAdvanceBy, http.StatusUnprocessableEntity,
			fmt.Sprintf("reading: invalid advanceBy %q on line %d", advanceBy, m.currentLineIndex))
	}

	switch {
	case advanceBy == "voice":
		m.mu.Unlock()
		return apperror.New(apperror.ErrReadingAdvanceForbidden, http.StatusForbidden,
			"reading: line advances on voice end; manual advance forbidden")
	case advanceBy == "gm":
		if !isHost {
			m.mu.Unlock()
			return apperror.New(apperror.ErrReadingAdvanceForbidden, http.StatusForbidden,
				"reading: only the host can advance this line")
		}
	case strings.HasPrefix(advanceBy, "role:"):
		need := strings.TrimPrefix(advanceBy, "role:")
		if roleID != need {
			m.mu.Unlock()
			return apperror.New(apperror.ErrReadingAdvanceForbidden, http.StatusForbidden,
				fmt.Sprintf("reading: only role %q can advance this line", need))
		}
	}

	// Permission OK — perform the advance under the held lock.
	if m.currentLineIndex >= m.totalLines-1 {
		m.isActive = false
		totalLines := m.totalLines
		m.mu.Unlock()
		m.deps.EventBus.Publish(engine.Event{
			Type:    "reading.completed",
			Payload: map[string]any{"totalLines": totalLines},
		})
		return nil
	}

	m.currentLineIndex++
	lineIndex := m.currentLineIndex
	totalLines := m.totalLines
	voiceID := m.resolveVoiceID(lineIndex)
	completed := m.currentLineIndex >= m.totalLines-1
	if completed {
		m.isActive = false
	}
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "reading.line_changed",
		Payload: map[string]any{
			"lineIndex":  lineIndex,
			"totalLines": totalLines,
			"voiceId":    voiceID,
		},
	})
	if completed {
		m.deps.EventBus.Publish(engine.Event{
			Type:    "reading.completed",
			Payload: map[string]any{"totalLines": totalLines},
		})
	}
	return nil
}

// HandleMessage is the legacy engine.Module entry point for reading messages.
//
// Deprecated: Use HandleAdvance / HandleVoiceEnded directly from the WS
// handler so that role/host permission checks (HandleAdvance) and the
// advanceBy="voice" gate (HandleVoiceEnded) are enforced. The
// "reading:advance" branch here intentionally bypasses permission checks and
// is retained only to satisfy the engine.Module interface for non-WS
// callers (e.g. legacy tests). New code MUST NOT route player input through
// this path.
func (m *ReadingModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	m.mu.Lock()

	switch msgType {
	case "reading:advance":
		// Legacy path: refuse all advance attempts here. Real callers MUST
		// route through HandleAdvance (which enforces host/role permission
		// per advanceBy) — bypassing it would be a security regression.
		m.mu.Unlock()
		return apperror.New(apperror.ErrReadingAdvanceForbidden, http.StatusForbidden,
			"reading: advance must go through HandleAdvance")

	case "reading:voice_ended":
		// Legacy path: refuse here. Real callers MUST route through
		// HandleVoiceEnded directly so the voiceID stale-race guard applies.
		m.mu.Unlock()
		return apperror.New(apperror.ErrReadingAdvanceForbidden, http.StatusForbidden,
			"reading: voice_ended must go through HandleVoiceEnded")

	case "reading:jump":
		if !m.isActive {
			m.mu.Unlock()
			return fmt.Errorf("reading: module not active")
		}
		var p struct {
			LineIndex int `json:"LineIndex"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			m.mu.Unlock()
			return fmt.Errorf("reading: invalid payload: %w", err)
		}
		if p.LineIndex < 0 || p.LineIndex >= m.totalLines {
			m.mu.Unlock()
			return fmt.Errorf("reading: line index %d out of range [0, %d)", p.LineIndex, m.totalLines)
		}

		m.currentLineIndex = p.LineIndex
		lineIndex := m.currentLineIndex
		totalLines := m.totalLines
		voiceID := m.resolveVoiceID(lineIndex)
		completed := m.currentLineIndex >= m.totalLines-1
		if completed {
			m.isActive = false
		}
		m.mu.Unlock()

		m.deps.EventBus.Publish(engine.Event{
			Type: "reading.line_changed",
			Payload: map[string]any{
				"lineIndex":  lineIndex,
				"totalLines": totalLines,
				"voiceId":    voiceID,
			},
		})

		// Check if jumped to last line
		if completed {
			m.deps.EventBus.Publish(engine.Event{
				Type:    "reading.completed",
				Payload: map[string]any{"totalLines": totalLines},
			})
		}
		return nil

	default:
		m.mu.Unlock()
		return fmt.Errorf("reading: unknown message type %q", msgType)
	}
}

// HandlePlayerLeft is invoked by the WS handler when a player disconnects.
// The handler resolves whether the leaving player is the host and which
// role IDs they owned, then calls this method. If the current line's
// effective advanceBy depends on the leaving party, the module enters the
// paused state and emits reading.paused. Voice-driven lines are unaffected
// since they advance on media end, not on a player action.
func (m *ReadingModule) HandlePlayerLeft(ctx context.Context, hostLeaving bool, leftRoleIDs []string) {
	m.mu.Lock()
	if !m.isActive || m.status != readingStatusPlaying {
		m.mu.Unlock()
		return
	}
	if m.totalLines <= 0 || m.currentLineIndex < 0 || m.currentLineIndex >= m.totalLines {
		m.mu.Unlock()
		return
	}
	advanceBy := m.resolveAdvanceBy(m.currentLineIndex)
	needsPause := false
	switch {
	case advanceBy == "gm" && hostLeaving:
		needsPause = true
	case strings.HasPrefix(advanceBy, "role:"):
		need := strings.TrimPrefix(advanceBy, "role:")
		for _, r := range leftRoleIDs {
			if r == need {
				needsPause = true
				break
			}
		}
	}
	if !needsPause {
		m.mu.Unlock()
		return
	}
	m.status = readingStatusPaused
	m.pausedReason = "player_left"
	lineIndex := m.currentLineIndex
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "reading.paused",
		Payload: map[string]any{
			"lineIndex": lineIndex,
			"advanceBy": advanceBy,
			"reason":    "player_left",
		},
	})
}

// HandlePlayerRejoined is invoked by the WS handler when the previously
// missing party returns. If the rejoining party satisfies the current line's
// advanceBy requirement, the module returns to the playing state and emits
// reading.resumed.
func (m *ReadingModule) HandlePlayerRejoined(ctx context.Context, hostRejoining bool, rejoinedRoleIDs []string) {
	m.mu.Lock()
	if m.status != readingStatusPaused {
		m.mu.Unlock()
		return
	}
	if m.totalLines <= 0 || m.currentLineIndex < 0 || m.currentLineIndex >= m.totalLines {
		m.mu.Unlock()
		return
	}
	advanceBy := m.resolveAdvanceBy(m.currentLineIndex)
	canResume := false
	switch {
	case advanceBy == "gm" && hostRejoining:
		canResume = true
	case strings.HasPrefix(advanceBy, "role:"):
		need := strings.TrimPrefix(advanceBy, "role:")
		for _, r := range rejoinedRoleIDs {
			if r == need {
				canResume = true
				break
			}
		}
	}
	if !canResume {
		m.mu.Unlock()
		return
	}
	m.status = readingStatusPlaying
	m.pausedReason = ""
	lineIndex := m.currentLineIndex
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "reading.resumed",
		Payload: map[string]any{
			"lineIndex": lineIndex,
			"advanceBy": advanceBy,
		},
	})
}

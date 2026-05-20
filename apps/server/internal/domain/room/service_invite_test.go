package room

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/db"
)

type fakeRoomInviteNotifier struct {
	onlineByUser map[uuid.UUID]bool
	calls        []RoomInviteNotification
	err          error
}

func (f *fakeRoomInviteNotifier) NotifyRoomInvite(_ context.Context, userID uuid.UUID, payload RoomInviteNotification) (bool, error) {
	f.calls = append(f.calls, payload)
	if f.err != nil {
		return false, f.err
	}
	return f.onlineByUser[userID], nil
}

func TestInviteFriendsServiceValidationBranches(t *testing.T) {
	roomID := uuid.New()
	themeID := uuid.New()
	inviterID := uuid.New()
	friendID := uuid.New()
	waitingRoom := db.Room{ID: roomID, ThemeID: themeID, HostID: inviterID, Code: "ABC234", Status: "WAITING"}

	tests := []struct {
		name       string
		req        RoomInviteRequest
		queries    *fakeRoomQueries
		notifier   RoomInviteNotifier
		wantStatus int
		wantSent   int
		wantReason string
	}{
		{
			name:       "empty friend list",
			req:        RoomInviteRequest{},
			queries:    &fakeRoomQueries{},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "room missing",
			req:        RoomInviteRequest{FriendIDs: []uuid.UUID{friendID}},
			queries:    &fakeRoomQueries{roomErr: pgx.ErrNoRows},
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "room lookup failure",
			req:        RoomInviteRequest{FriendIDs: []uuid.UUID{friendID}},
			queries:    &fakeRoomQueries{roomErr: errors.New("db unavailable")},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:       "room not waiting",
			req:        RoomInviteRequest{FriendIDs: []uuid.UUID{friendID}},
			queries:    &fakeRoomQueries{room: db.Room{ID: roomID, Status: "PLAYING"}},
			wantStatus: http.StatusConflict,
		},
		{
			name: "inviter is not host",
			req:  RoomInviteRequest{FriendIDs: []uuid.UUID{friendID}},
			queries: &fakeRoomQueries{
				room:    db.Room{ID: roomID, ThemeID: themeID, HostID: uuid.New(), Code: "ABC234", Status: "WAITING"},
				players: []db.RoomPlayer{{RoomID: roomID, UserID: inviterID}},
			},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "inviter is not participant",
			req:  RoomInviteRequest{FriendIDs: []uuid.UUID{friendID}},
			queries: &fakeRoomQueries{
				room:    waitingRoom,
				players: []db.RoomPlayer{{RoomID: roomID, UserID: uuid.New()}},
			},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "target is not accepted friend",
			req:  RoomInviteRequest{FriendIDs: []uuid.UUID{friendID}},
			queries: inviteFakeQueries(waitingRoom, inviterID, map[uuid.UUID]db.Friendship{
				friendID: {RequesterID: inviterID, AddresseeID: friendID, Status: "PENDING"},
			}),
			wantReason: "not_friend",
		},
		{
			name: "invalid friend id is skipped",
			req:  RoomInviteRequest{FriendIDs: []uuid.UUID{uuid.Nil}},
			queries: inviteFakeQueries(waitingRoom, inviterID, map[uuid.UUID]db.Friendship{
				friendID: {RequesterID: inviterID, AddresseeID: friendID, Status: "ACCEPTED"},
			}),
			wantReason: "invalid_friend_id",
		},
		{
			name:       "duplicate friend id is skipped after first send",
			req:        RoomInviteRequest{FriendIDs: []uuid.UUID{friendID, friendID}},
			queries:    inviteFakeQueries(waitingRoom, inviterID, acceptedFriend(inviterID, friendID)),
			wantSent:   1,
			wantReason: "duplicate",
		},
		{
			name: "blocked target is skipped",
			req:  RoomInviteRequest{FriendIDs: []uuid.UUID{friendID}},
			queries: func() *fakeRoomQueries {
				q := inviteFakeQueries(waitingRoom, inviterID, acceptedFriend(inviterID, friendID))
				q.blockedUsers = map[uuid.UUID]bool{friendID: true}
				return q
			}(),
			wantReason: "blocked",
		},
		{
			name: "existing participant is skipped",
			req:  RoomInviteRequest{FriendIDs: []uuid.UUID{friendID}},
			queries: func() *fakeRoomQueries {
				q := inviteFakeQueries(waitingRoom, inviterID, acceptedFriend(inviterID, friendID))
				q.players = append(q.players, db.RoomPlayer{RoomID: roomID, UserID: friendID})
				return q
			}(),
			wantReason: "already_participant",
		},
		{
			name: "notification opt out is skipped",
			req:  RoomInviteRequest{FriendIDs: []uuid.UUID{friendID}},
			queries: func() *fakeRoomQueries {
				q := inviteFakeQueries(waitingRoom, inviterID, acceptedFriend(inviterID, friendID))
				q.gameInvitePrefs = map[uuid.UUID]bool{friendID: false}
				return q
			}(),
			wantReason: "notification_disabled",
		},
		{
			name:       "nil notifier returns eligible invite as offline sent",
			req:        RoomInviteRequest{FriendIDs: []uuid.UUID{friendID}},
			queries:    inviteFakeQueries(waitingRoom, inviterID, acceptedFriend(inviterID, friendID)),
			wantSent:   1,
			wantReason: "",
		},
		{
			name:       "notifier failure skips eligible invite",
			req:        RoomInviteRequest{FriendIDs: []uuid.UUID{friendID}},
			queries:    inviteFakeQueries(waitingRoom, inviterID, acceptedFriend(inviterID, friendID)),
			notifier:   &fakeRoomInviteNotifier{onlineByUser: map[uuid.UUID]bool{friendID: true}, err: errors.New("ws unavailable")},
			wantReason: "notification_failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &service{queries: tt.queries, logger: zerolog.Nop(), inviteNotifier: tt.notifier}

			resp, err := svc.InviteFriends(context.Background(), roomID, inviterID, tt.req)

			if tt.wantStatus != 0 {
				assertAppError(t, err, tt.wantStatus)
				return
			}
			if err != nil {
				t.Fatalf("InviteFriends returned error: %v", err)
			}
			if resp.Sent == nil || resp.Skipped == nil {
				t.Fatalf("sent/skipped must be non-nil arrays: %+v", resp)
			}
			if len(resp.Sent) != tt.wantSent {
				t.Fatalf("sent len = %d, want %d: %+v", len(resp.Sent), tt.wantSent, resp)
			}
			if tt.wantReason != "" {
				if len(resp.Skipped) != 1 || resp.Skipped[0].Reason != tt.wantReason {
					t.Fatalf("skipped = %+v, want reason %q", resp.Skipped, tt.wantReason)
				}
			}
		})
	}
}

func TestInviteFriendsServiceNotifiesOnlineFriends(t *testing.T) {
	roomID := uuid.New()
	themeID := uuid.New()
	inviterID := uuid.New()
	friendID := uuid.New()
	roomRow := db.Room{ID: roomID, ThemeID: themeID, HostID: inviterID, Code: "ABC234", Status: "WAITING"}
	queries := inviteFakeQueries(roomRow, inviterID, acceptedFriend(inviterID, friendID))
	notifier := &fakeRoomInviteNotifier{onlineByUser: map[uuid.UUID]bool{friendID: true}}
	svc := &service{queries: queries, logger: zerolog.Nop(), inviteNotifier: notifier}

	resp, err := svc.InviteFriends(context.Background(), roomID, inviterID, RoomInviteRequest{FriendIDs: []uuid.UUID{friendID}})

	if err != nil {
		t.Fatalf("InviteFriends returned error: %v", err)
	}
	if len(resp.Sent) != 1 || resp.Sent[0].FriendID != friendID || resp.Sent[0].Nickname != "friend" || !resp.Sent[0].Online {
		t.Fatalf("sent mismatch: %+v", resp.Sent)
	}
	if len(notifier.calls) != 1 {
		t.Fatalf("notifier calls = %d, want 1", len(notifier.calls))
	}
	payload := notifier.calls[0]
	if payload.RoomID != roomID || payload.Code != "ABC234" || payload.ThemeTitle != "Mystery" || payload.InviterID != inviterID || payload.InviterNickname != "host" {
		t.Fatalf("payload mismatch: %+v", payload)
	}
}

func inviteFakeQueries(roomRow db.Room, inviterID uuid.UUID, friendships map[uuid.UUID]db.Friendship) *fakeRoomQueries {
	users := map[uuid.UUID]db.User{inviterID: {ID: inviterID, Nickname: "host"}}
	for friendID := range friendships {
		users[friendID] = db.User{ID: friendID, Nickname: "friend"}
	}
	return &fakeRoomQueries{
		room:        roomRow,
		theme:       db.Theme{ID: roomRow.ThemeID, Title: "Mystery"},
		players:     []db.RoomPlayer{{RoomID: roomRow.ID, UserID: inviterID}},
		users:       users,
		friendships: friendships,
	}
}

func acceptedFriend(inviterID, friendID uuid.UUID) map[uuid.UUID]db.Friendship {
	return map[uuid.UUID]db.Friendship{
		friendID: {RequesterID: inviterID, AddresseeID: friendID, Status: "ACCEPTED"},
	}
}

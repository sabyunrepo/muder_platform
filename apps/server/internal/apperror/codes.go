package apperror

// Error code constants used throughout the application.
// All error codes follow the pattern: DOMAIN_REASON.
const (
	// Generic errors
	ErrInternal     = "INTERNAL_ERROR"
	ErrNotFound     = "NOT_FOUND"
	ErrBadRequest   = "BAD_REQUEST"
	ErrUnauthorized = "UNAUTHORIZED"
	ErrForbidden    = "FORBIDDEN"
	ErrConflict     = "CONFLICT"
	ErrValidation   = "VALIDATION_ERROR"
	ErrTimeout      = "TIMEOUT"

	// Auth errors
	ErrAuthTokenExpired = "AUTH_TOKEN_EXPIRED"
	ErrAuthTokenInvalid = "AUTH_TOKEN_INVALID"
	ErrAuthTokenMissing = "AUTH_TOKEN_MISSING"

	// Game errors
	ErrGameNotFound    = "GAME_NOT_FOUND"
	ErrGameFull        = "GAME_FULL"
	ErrGameNotStarted  = "GAME_NOT_STARTED"
	ErrGameAlreadyOver = "GAME_ALREADY_OVER"

	// Session errors
	ErrSessionNotFound = "SESSION_NOT_FOUND"
	ErrSessionExpired  = "SESSION_EXPIRED"

	// Player errors
	ErrPlayerNotFound   = "PLAYER_NOT_FOUND"
	ErrPlayerNotInGame  = "PLAYER_NOT_IN_GAME"
	ErrPlayerAlreadyIn  = "PLAYER_ALREADY_IN_GAME"

	// Room errors
	ErrRoomNotFound   = "ROOM_NOT_FOUND"
	ErrRoomFull       = "ROOM_FULL"
	ErrRoomNotWaiting = "ROOM_NOT_WAITING"

	// Social errors
	ErrFriendRequestSelf      = "FRIEND_REQUEST_SELF"
	ErrFriendRequestDuplicate = "FRIEND_REQUEST_DUPLICATE"
	ErrFriendRequestBlocked   = "FRIEND_REQUEST_BLOCKED"
	ErrFriendshipNotFound     = "FRIENDSHIP_NOT_FOUND"
	ErrChatRoomNotFound       = "CHAT_ROOM_NOT_FOUND"
	ErrChatNotMember          = "CHAT_NOT_MEMBER"
	ErrChatInvalidMsgType     = "CHAT_INVALID_MESSAGE_TYPE"
)

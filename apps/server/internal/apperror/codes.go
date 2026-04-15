package apperror

// Error code constants used throughout the application.
// All error codes follow the pattern: DOMAIN_REASON.
const (
	// Generic errors
	ErrInternal           = "INTERNAL_ERROR"
	ErrNotFound           = "NOT_FOUND"
	ErrBadRequest         = "BAD_REQUEST"
	ErrUnauthorized       = "UNAUTHORIZED"
	ErrForbidden          = "FORBIDDEN"
	ErrConflict           = "CONFLICT"
	ErrValidation         = "VALIDATION_ERROR"
	ErrTimeout            = "TIMEOUT"
	ErrServiceUnavailable = "SERVICE_UNAVAILABLE"

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
	ErrSessionNotFound  = "SESSION_NOT_FOUND"
	ErrSessionExpired   = "SESSION_EXPIRED"
	ErrSessionStopped   = "SESSION_STOPPED"
	ErrSessionInboxFull = "SESSION_INBOX_FULL"
	ErrInvalidPayload   = "INVALID_PAYLOAD"

	// Player errors
	ErrPlayerNotFound  = "PLAYER_NOT_FOUND"
	ErrPlayerNotInGame = "PLAYER_NOT_IN_GAME"
	ErrPlayerAlreadyIn = "PLAYER_ALREADY_IN_GAME"

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
	ErrChatBlocked            = "CHAT_BLOCKED"

	// Payment errors
	ErrPaymentDuplicate           = "PAYMENT_DUPLICATE"
	ErrPaymentIdempotencyMismatch = "PAYMENT_IDEMPOTENCY_MISMATCH"
	ErrPaymentNotFound            = "PAYMENT_NOT_FOUND"
	ErrPaymentInvalidStatus       = "PAYMENT_INVALID_STATUS"
	ErrPaymentProviderError       = "PAYMENT_PROVIDER_ERROR"
	ErrPaymentWebhookInvalid      = "PAYMENT_WEBHOOK_INVALID"

	// Coin errors
	ErrCoinInsufficient    = "COIN_INSUFFICIENT"
	ErrCoinBalanceMismatch = "COIN_BALANCE_MISMATCH"

	// Purchase errors
	ErrPurchaseAlreadyOwned = "PURCHASE_ALREADY_OWNED"
	ErrPurchaseSelfTheme    = "PURCHASE_SELF_THEME"
	ErrPurchaseNotFound     = "PURCHASE_NOT_FOUND"

	// Refund errors
	ErrRefundExpired       = "REFUND_EXPIRED"
	ErrRefundAlreadyPlayed = "REFUND_ALREADY_PLAYED"
	ErrRefundAlreadyDone   = "REFUND_ALREADY_DONE"
	ErrRefundFreeTheme     = "REFUND_FREE_THEME"
	ErrRefundLimitExceeded = "REFUND_LIMIT_EXCEEDED"

	// Settlement errors
	ErrSettlementInvalidStatus = "SETTLEMENT_INVALID_STATUS"

	// Theme price errors
	ErrThemePriceNotSet     = "THEME_PRICE_NOT_SET"
	ErrThemePriceOutOfRange = "THEME_PRICE_OUT_OF_RANGE"

	// Media errors
	ErrMediaInvalidType   = "MEDIA_INVALID_TYPE"
	ErrMediaInvalidURL    = "MEDIA_INVALID_URL"
	ErrMediaTooLarge      = "MEDIA_TOO_LARGE"
	ErrMediaLimitExceeded = "MEDIA_LIMIT_EXCEEDED"
	ErrMediaStorageFull   = "MEDIA_STORAGE_FULL"
	ErrMediaUploadExpired = "MEDIA_UPLOAD_EXPIRED"
	ErrMediaOEmbedFailed  = "MEDIA_OEMBED_FAILED"

	// Reading errors
	ErrReadingSectionNotFound  = "READING_SECTION_NOT_FOUND"
	ErrReadingAdvanceForbidden = "READING_ADVANCE_FORBIDDEN"
	ErrReadingInvalidAdvanceBy = "READING_INVALID_ADVANCE_BY"
	ErrReadingLineOutOfRange   = "READING_LINE_OUT_OF_RANGE"
	ErrReadingVoiceRequired    = "READING_VOICE_REQUIRED"

	// Media playback runtime errors
	ErrMediaReferenceInUse = "MEDIA_REFERENCE_IN_USE"
	ErrMediaNotInTheme     = "MEDIA_NOT_IN_THEME"

	// Image upload errors
	ErrImageInvalidType   = "IMAGE_INVALID_TYPE"
	ErrImageInvalidTarget = "IMAGE_INVALID_TARGET"
	ErrImageTooLarge      = "IMAGE_TOO_LARGE"

	// WebSocket message errors
	ErrWSUnknownMessageType = "WS_UNKNOWN_MESSAGE_TYPE"

	// Editor errors
	ErrEditorConfigVersionMismatch = "EDITOR_CONFIG_VERSION_MISMATCH"
)

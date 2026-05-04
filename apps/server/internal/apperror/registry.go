package apperror

import "net/http"

// Severity is the operational impact level for an application error.
type Severity string

const (
	SeverityCritical Severity = "critical"
	SeverityHigh     Severity = "high"
	SeverityMedium   Severity = "medium"
	SeverityLow      Severity = "low"
)

// ErrorDefinition describes how a code should be exposed and recovered from.
// It is intentionally metadata-only: the concrete AppError still owns status
// and detail for each occurrence.
type ErrorDefinition struct {
	Code       string
	Domain     string
	Layer      string
	Severity   Severity
	HTTPStatus int
	Retryable  bool
	UserAction string
	DefaultKR  string
}

var errorDefinitions = map[string]ErrorDefinition{
	ErrInternal:           def(ErrInternal, "common", "infrastructure", http.StatusInternalServerError, SeverityHigh, true, "retry_later", "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."),
	ErrNotFound:           def(ErrNotFound, "common", "interface", http.StatusNotFound, SeverityMedium, false, "go_back", "요청한 리소스를 찾을 수 없습니다."),
	ErrBadRequest:         def(ErrBadRequest, "common", "interface", http.StatusBadRequest, SeverityMedium, false, "fix_input", "요청 내용을 확인해주세요."),
	ErrUnauthorized:       def(ErrUnauthorized, "auth", "interface", http.StatusUnauthorized, SeverityHigh, false, "login", "로그인이 필요합니다."),
	ErrForbidden:          def(ErrForbidden, "auth", "interface", http.StatusForbidden, SeverityHigh, false, "request_access", "접근 권한이 없습니다."),
	ErrConflict:           def(ErrConflict, "common", "domain", http.StatusConflict, SeverityMedium, false, "refresh", "현재 상태와 충돌했습니다. 새로고침 후 다시 시도해주세요."),
	ErrValidation:         def(ErrValidation, "common", "interface", http.StatusUnprocessableEntity, SeverityMedium, false, "fix_input", "입력값을 확인해주세요."),
	ErrTimeout:            def(ErrTimeout, "common", "infrastructure", http.StatusRequestTimeout, SeverityMedium, true, "retry", "요청 시간이 초과되었습니다. 다시 시도해주세요."),
	ErrServiceUnavailable: def(ErrServiceUnavailable, "common", "infrastructure", http.StatusServiceUnavailable, SeverityHigh, true, "retry_later", "서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요."),
	ErrMethodNotAllowed:   def(ErrMethodNotAllowed, "common", "interface", http.StatusMethodNotAllowed, SeverityLow, false, "none", "지원하지 않는 요청 방식입니다."),

	ErrAuthTokenExpired: def(ErrAuthTokenExpired, "auth", "interface", http.StatusUnauthorized, SeverityHigh, false, "login", "세션이 만료되었습니다. 다시 로그인해주세요."),
	ErrAuthTokenInvalid: def(ErrAuthTokenInvalid, "auth", "interface", http.StatusUnauthorized, SeverityHigh, false, "login", "인증 정보가 유효하지 않습니다."),
	ErrAuthTokenMissing: def(ErrAuthTokenMissing, "auth", "interface", http.StatusUnauthorized, SeverityHigh, false, "login", "로그인이 필요합니다."),

	ErrGameNotFound:    def(ErrGameNotFound, "game", "domain", http.StatusNotFound, SeverityMedium, false, "go_back", "게임을 찾을 수 없습니다."),
	ErrGameFull:        def(ErrGameFull, "game", "domain", http.StatusConflict, SeverityMedium, false, "choose_other", "게임 정원이 가득 찼습니다."),
	ErrGameNotStarted:  def(ErrGameNotStarted, "game", "domain", http.StatusConflict, SeverityLow, true, "wait", "아직 게임이 시작되지 않았습니다."),
	ErrGameAlreadyOver: def(ErrGameAlreadyOver, "game", "domain", http.StatusConflict, SeverityMedium, false, "go_back", "이미 종료된 게임입니다."),

	ErrSessionNotFound:  def(ErrSessionNotFound, "session", "domain", http.StatusNotFound, SeverityMedium, false, "go_back", "세션을 찾을 수 없습니다."),
	ErrSessionExpired:   def(ErrSessionExpired, "session", "domain", http.StatusGone, SeverityMedium, false, "restart", "세션이 만료되었습니다."),
	ErrSessionStopped:   def(ErrSessionStopped, "session", "domain", http.StatusConflict, SeverityHigh, false, "restart", "세션이 중단되었습니다."),
	ErrSessionInboxFull: def(ErrSessionInboxFull, "session", "application", http.StatusTooManyRequests, SeverityMedium, true, "retry_later", "요청이 많아 잠시 후 다시 시도해주세요."),
	ErrInvalidPayload:   def(ErrInvalidPayload, "session", "interface", http.StatusBadRequest, SeverityMedium, false, "fix_input", "요청 데이터가 올바르지 않습니다."),

	ErrPlayerNotFound:  def(ErrPlayerNotFound, "player", "domain", http.StatusNotFound, SeverityMedium, false, "go_back", "플레이어를 찾을 수 없습니다."),
	ErrPlayerNotInGame: def(ErrPlayerNotInGame, "player", "domain", http.StatusForbidden, SeverityHigh, false, "join_game", "해당 게임에 참여하지 않은 플레이어입니다."),
	ErrPlayerAlreadyIn: def(ErrPlayerAlreadyIn, "player", "domain", http.StatusConflict, SeverityLow, false, "none", "이미 게임에 참여 중입니다."),

	ErrRoomNotFound:   def(ErrRoomNotFound, "room", "domain", http.StatusNotFound, SeverityMedium, false, "go_back", "방을 찾을 수 없습니다."),
	ErrRoomFull:       def(ErrRoomFull, "room", "domain", http.StatusConflict, SeverityMedium, false, "choose_other", "방이 가득 찼습니다."),
	ErrRoomNotWaiting: def(ErrRoomNotWaiting, "room", "domain", http.StatusConflict, SeverityMedium, false, "choose_other", "현재 참가할 수 없는 방입니다."),

	ErrFriendRequestSelf:      def(ErrFriendRequestSelf, "social", "domain", http.StatusBadRequest, SeverityLow, false, "fix_input", "자기 자신에게 친구 요청을 보낼 수 없습니다."),
	ErrFriendRequestDuplicate: def(ErrFriendRequestDuplicate, "social", "domain", http.StatusConflict, SeverityLow, false, "none", "이미 보낸 친구 요청입니다."),
	ErrFriendRequestBlocked:   def(ErrFriendRequestBlocked, "social", "domain", http.StatusForbidden, SeverityMedium, false, "none", "친구 요청을 보낼 수 없습니다."),
	ErrFriendshipNotFound:     def(ErrFriendshipNotFound, "social", "domain", http.StatusNotFound, SeverityLow, false, "refresh", "친구 관계를 찾을 수 없습니다."),
	ErrChatRoomNotFound:       def(ErrChatRoomNotFound, "social", "domain", http.StatusNotFound, SeverityMedium, false, "go_back", "채팅방을 찾을 수 없습니다."),
	ErrChatNotMember:          def(ErrChatNotMember, "social", "domain", http.StatusForbidden, SeverityHigh, false, "go_back", "채팅방 참여자가 아닙니다."),
	ErrChatInvalidMsgType:     def(ErrChatInvalidMsgType, "social", "interface", http.StatusBadRequest, SeverityLow, false, "none", "지원하지 않는 채팅 메시지입니다."),
	ErrChatBlocked:            def(ErrChatBlocked, "social", "domain", http.StatusForbidden, SeverityMedium, false, "none", "차단된 사용자와는 채팅할 수 없습니다."),

	ErrPaymentDuplicate:           def(ErrPaymentDuplicate, "payment", "domain", http.StatusConflict, SeverityMedium, false, "refresh", "이미 처리된 결제입니다."),
	ErrPaymentIdempotencyMismatch: def(ErrPaymentIdempotencyMismatch, "payment", "domain", http.StatusConflict, SeverityHigh, false, "contact_support", "결제 요청 정보가 이전 요청과 다릅니다. 고객센터에 문의해주세요."),
	ErrPaymentNotFound:            def(ErrPaymentNotFound, "payment", "domain", http.StatusNotFound, SeverityMedium, false, "go_back", "결제 정보를 찾을 수 없습니다."),
	ErrPaymentInvalidStatus:       def(ErrPaymentInvalidStatus, "payment", "domain", http.StatusConflict, SeverityMedium, false, "refresh", "현재 결제 상태에서 처리할 수 없습니다."),
	ErrPaymentProviderError:       def(ErrPaymentProviderError, "payment", "infrastructure", http.StatusBadGateway, SeverityHigh, true, "retry_later", "결제사 연결이 불안정합니다. 잠시 후 다시 시도해주세요."),
	ErrPaymentWebhookInvalid:      def(ErrPaymentWebhookInvalid, "payment", "interface", http.StatusBadRequest, SeverityHigh, false, "none", "결제 알림 검증에 실패했습니다."),

	ErrCoinInsufficient:    def(ErrCoinInsufficient, "coin", "domain", http.StatusConflict, SeverityMedium, false, "charge", "보유 코인이 부족합니다."),
	ErrCoinBalanceMismatch: def(ErrCoinBalanceMismatch, "coin", "domain", http.StatusConflict, SeverityHigh, true, "retry", "코인 잔액이 변경되었습니다. 다시 시도해주세요."),

	ErrPurchaseAlreadyOwned: def(ErrPurchaseAlreadyOwned, "purchase", "domain", http.StatusConflict, SeverityLow, false, "none", "이미 보유한 테마입니다."),
	ErrPurchaseSelfTheme:    def(ErrPurchaseSelfTheme, "purchase", "domain", http.StatusBadRequest, SeverityLow, false, "none", "자신이 만든 테마는 구매할 수 없습니다."),
	ErrPurchaseNotFound:     def(ErrPurchaseNotFound, "purchase", "domain", http.StatusNotFound, SeverityMedium, false, "go_back", "구매 정보를 찾을 수 없습니다."),

	ErrRefundExpired:       def(ErrRefundExpired, "refund", "domain", http.StatusConflict, SeverityMedium, false, "none", "환불 가능 기간이 지났습니다."),
	ErrRefundAlreadyPlayed: def(ErrRefundAlreadyPlayed, "refund", "domain", http.StatusConflict, SeverityMedium, false, "none", "이미 플레이한 테마는 환불할 수 없습니다."),
	ErrRefundAlreadyDone:   def(ErrRefundAlreadyDone, "refund", "domain", http.StatusConflict, SeverityLow, false, "none", "이미 환불 처리된 구매입니다."),
	ErrRefundFreeTheme:     def(ErrRefundFreeTheme, "refund", "domain", http.StatusBadRequest, SeverityLow, false, "none", "무료 테마는 환불할 수 없습니다."),
	ErrRefundLimitExceeded: def(ErrRefundLimitExceeded, "refund", "domain", http.StatusTooManyRequests, SeverityMedium, false, "contact_support", "환불 요청 한도를 초과했습니다."),

	ErrSettlementInvalidStatus: def(ErrSettlementInvalidStatus, "settlement", "domain", http.StatusConflict, SeverityMedium, false, "refresh", "현재 정산 상태에서 처리할 수 없습니다."),
	ErrThemePriceNotSet:        def(ErrThemePriceNotSet, "theme", "domain", http.StatusConflict, SeverityMedium, false, "set_price", "테마 가격이 설정되지 않았습니다."),
	ErrThemePriceOutOfRange:    def(ErrThemePriceOutOfRange, "theme", "domain", http.StatusBadRequest, SeverityMedium, false, "fix_input", "테마 가격 범위를 확인해주세요."),

	ErrMediaInvalidType:     def(ErrMediaInvalidType, "media", "interface", http.StatusBadRequest, SeverityMedium, false, "choose_file", "지원하지 않는 미디어 형식입니다."),
	ErrMediaInvalidURL:      def(ErrMediaInvalidURL, "media", "interface", http.StatusBadRequest, SeverityMedium, false, "fix_input", "미디어 URL이 올바르지 않습니다."),
	ErrMediaTooLarge:        def(ErrMediaTooLarge, "media", "interface", http.StatusRequestEntityTooLarge, SeverityMedium, false, "choose_smaller_file", "파일 크기가 너무 큽니다."),
	ErrMediaLimitExceeded:   def(ErrMediaLimitExceeded, "media", "domain", http.StatusConflict, SeverityMedium, false, "delete_unused", "미디어 개수 제한을 초과했습니다."),
	ErrMediaStorageFull:     def(ErrMediaStorageFull, "media", "infrastructure", http.StatusInsufficientStorage, SeverityHigh, false, "contact_support", "저장 공간이 부족합니다. 관리자에게 문의해주세요."),
	ErrMediaUploadExpired:   def(ErrMediaUploadExpired, "media", "domain", http.StatusGone, SeverityLow, true, "retry", "업로드 시간이 만료되었습니다. 다시 시도해주세요."),
	ErrMediaOEmbedFailed:    def(ErrMediaOEmbedFailed, "media", "infrastructure", http.StatusBadGateway, SeverityMedium, true, "retry", "외부 미디어 정보를 가져오지 못했습니다."),
	ErrMediaReferenceInUse:  def(ErrMediaReferenceInUse, "media", "domain", http.StatusConflict, SeverityMedium, false, "review_references", "이 미디어는 다른 곳에서 사용 중이라 삭제할 수 없습니다."),
	ErrMediaNotInTheme:      def(ErrMediaNotInTheme, "media", "domain", http.StatusForbidden, SeverityHigh, false, "go_back", "이 테마에 속하지 않은 미디어입니다."),
	ErrImageInvalidType:     def(ErrImageInvalidType, "image", "interface", http.StatusBadRequest, SeverityMedium, false, "choose_file", "지원하지 않는 이미지 형식입니다."),
	ErrImageInvalidTarget:   def(ErrImageInvalidTarget, "image", "interface", http.StatusBadRequest, SeverityMedium, false, "fix_input", "이미지 업로드 대상이 올바르지 않습니다."),
	ErrImageTooLarge:        def(ErrImageTooLarge, "image", "interface", http.StatusRequestEntityTooLarge, SeverityMedium, false, "choose_smaller_file", "이미지 크기가 너무 큽니다."),
	ErrWSUnknownMessageType: def(ErrWSUnknownMessageType, "websocket", "interface", http.StatusBadRequest, SeverityLow, false, "none", "지원하지 않는 실시간 메시지입니다."),

	ErrReadingSectionNotFound:  def(ErrReadingSectionNotFound, "reading", "domain", http.StatusNotFound, SeverityMedium, false, "refresh", "리딩 섹션을 찾을 수 없습니다."),
	ErrReadingAdvanceForbidden: def(ErrReadingAdvanceForbidden, "reading", "domain", http.StatusForbidden, SeverityMedium, false, "wait", "리딩을 진행할 권한이 없습니다."),
	ErrReadingInvalidAdvanceBy: def(ErrReadingInvalidAdvanceBy, "reading", "interface", http.StatusUnprocessableEntity, SeverityMedium, false, "fix_input", "리딩 진행 방식이 올바르지 않습니다."),
	ErrReadingLineOutOfRange:   def(ErrReadingLineOutOfRange, "reading", "domain", http.StatusNotFound, SeverityMedium, false, "refresh", "리딩 줄이 범위를 벗어났습니다."),
	ErrReadingVoiceRequired:    def(ErrReadingVoiceRequired, "reading", "domain", http.StatusConflict, SeverityMedium, false, "add_media", "음성 자동 진행에는 음성 파일이 필요합니다."),

	ErrEditorConfigVersionMismatch: def(ErrEditorConfigVersionMismatch, "editor", "domain", http.StatusConflict, SeverityHigh, false, "reload_or_merge", "다른 변경사항과 충돌했습니다. 최신 내용으로 새로고침 후 다시 저장해주세요."),
}

func def(code, domain, layer string, status int, severity Severity, retryable bool, userAction, defaultKR string) ErrorDefinition {
	return ErrorDefinition{
		Code:       code,
		Domain:     domain,
		Layer:      layer,
		Severity:   severity,
		HTTPStatus: status,
		Retryable:  retryable,
		UserAction: userAction,
		DefaultKR:  defaultKR,
	}
}

// LookupDefinition returns registry metadata for a known error code.
func LookupDefinition(code string) (ErrorDefinition, bool) {
	defn, ok := errorDefinitions[code]
	return defn, ok
}

func definitionForResponse(appErr *AppError) ErrorDefinition {
	if defn, ok := LookupDefinition(appErr.Code); ok {
		defn.HTTPStatus = appErr.Status
		return defn
	}

	return def(appErr.Code, "unknown", "unknown", appErr.Status, severityForStatus(appErr.Status), appErr.Status >= 500 || appErr.Status == http.StatusRequestTimeout, defaultActionForStatus(appErr.Status), "")
}

func severityForStatus(status int) Severity {
	switch {
	case status >= 500:
		return SeverityHigh
	case status == http.StatusUnauthorized || status == http.StatusForbidden:
		return SeverityHigh
	case status >= 400:
		return SeverityMedium
	default:
		return SeverityLow
	}
}

func defaultActionForStatus(status int) string {
	switch {
	case status == http.StatusUnauthorized:
		return "login"
	case status == http.StatusForbidden:
		return "request_access"
	case status == http.StatusRequestTimeout || status >= 500:
		return "retry_later"
	case status >= 400:
		return "fix_input"
	default:
		return "none"
	}
}

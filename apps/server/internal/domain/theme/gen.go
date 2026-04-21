// Package theme
//
// mockgen 지시자는 프로덕션 소스(service.go)에 부담을 주지 않도록
// 전용 파일로 분리. 'make mocks' 또는 'cd apps/server && go generate ./...' 에서 실행.

//go:generate go tool mockgen -destination=mocks/mock_service.go -package=mocks -source=service.go Service

package theme

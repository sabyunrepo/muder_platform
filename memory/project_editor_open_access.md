---
name: 에디터 개방 + 심사 플로우
description: Phase 10.0 이후 — 에디터 전유저 개방, 게시 심사 워크플로우, 이미지 업로드/크롭 구현 완료
type: project
originSessionId: 9027290a-1112-4e04-8417-e6a1a5a9744a
---
2026-04-13 작업 완료.

## 에디터 개방
- RequireRole("CREATOR","ADMIN") 제거 → 모든 인증 유저 에디터 접근 가능
- 사이드바 General 섹션에 "테마 제작" 메뉴 추가
- /editor 라우트 EditorDashboard로 복원

## 게시 심사 플로우
- 6개 상태: DRAFT → PENDING_REVIEW → PUBLISHED / REJECTED / UNPUBLISHED / SUSPENDED
- SubmitForReview: DRAFT/REJECTED에서만 가능, 검증 후 제출
- 신뢰도 기반 자동 승인: users.trusted_creator = true → 즉시 PUBLISHED
- 어드민 심사 API: approve/reject/suspend + 반려 사유
- PublishTheme 직접 라우트 제거 (보안 수정)
- DB: migration 00019 (review_note, reviewed_at, reviewed_by, trusted_creator)

## 이미지 업로드
- 로컬 파일 스토리지 폴백 (dev 503 해결)
- 이미지 전용 presigned URL 플로우 (upload-url → PUT → confirm)
- 캐릭터: react-image-crop 1:1 크롭 후 업로드
- 단서: 원본 그대로 업로드, ClueForm 원스텝(이미지 선택+저장 동시)
- ClueForm 간소화: 이름/설명/이미지만 기본, 고급 설정 접기

**Why:** 플랫폼이므로 모든 유저가 테마 제작 가능해야 함. 품질 관리를 위해 사전 심사 도입.
**How to apply:** 다음 작업 시 에디터 관련 변경은 이 구조 위에서 진행.

# 에디터 개방 + 게시 승인 플로우 설계

> 날짜: 2026-04-13
> 상태: 승인됨

## 목표

1. 모든 유저가 테마 에디터에 접근하여 자체 테마 제작 가능
2. 게시 전 어드민 심사 플로우 도입 (품질 관리)
3. 신뢰도 기반 자동 승인 확장 지원

## 테마 상태 모델

```
DRAFT → PENDING_REVIEW → PUBLISHED
              ↓
          REJECTED → (수정) → PENDING_REVIEW

PUBLISHED → UNPUBLISHED (작성자 비공개 전환)
PUBLISHED → SUSPENDED (어드민 정지)
```

| 상태 | 의미 | 전환 주체 |
|------|------|----------|
| DRAFT | 작성 중 | 유저 |
| PENDING_REVIEW | 심사 대기 | 유저 (게시 신청) |
| PUBLISHED | 게시됨 | 어드민 승인 / 자동 승인 |
| REJECTED | 반려 (사유 포함) | 어드민 |
| UNPUBLISHED | 작성자 비공개 | 유저 |
| SUSPENDED | 어드민 정지 | 어드민 |

## 신뢰도 기반 자동 승인

- `users.trusted_creator BOOLEAN DEFAULT false`
- `trusted_creator = true` → 게시 신청 시 즉시 PUBLISHED
- `trusted_creator = false` → PENDING_REVIEW → 어드민 심사
- 어드민이 유저별 trusted_creator 토글

## DB 변경

```sql
-- themes: 심사 필드 추가
ALTER TABLE themes ADD COLUMN review_note TEXT;
ALTER TABLE themes ADD COLUMN reviewed_at TIMESTAMPTZ;
ALTER TABLE themes ADD COLUMN reviewed_by UUID REFERENCES users(id);

-- users: 신뢰도 필드
ALTER TABLE users ADD COLUMN trusted_creator BOOLEAN NOT NULL DEFAULT false;
```

status 컬럼 값 확장: PENDING_REVIEW, REJECTED, UNPUBLISHED, SUSPENDED 추가.

## 접근 제어 변경

| 대상 | 현재 | 변경 후 |
|------|------|---------|
| 백엔드 main.go:380 | RequireRole("CREATOR", "ADMIN") | 인증만 |
| 프론트 Sidebar.tsx | Creator 섹션에 에디터 | General 섹션에 "테마 제작" |
| 프론트 App.tsx | /editor → Navigate to /my-themes | /editor → EditorDashboard |

## 네비게이션

General (모든 유저): 로비, 소셜, 상점, 내 테마, **테마 제작**
Creator (creator/admin): 대시보드, 수익, 정산
Admin: + **테마 심사** 메뉴

## 어드민 심사 페이지

- PENDING_REVIEW 테마 목록
- 테마 미리보기 (설정, 캐릭터, 맵 등)
- 승인 / 반려(사유) 버튼
- review_note + reviewed_at + reviewed_by 저장

## 구현 범위

1. DB 마이그레이션 (themes + users)
2. 백엔드: RequireRole 제거, 상태 전환 API, 어드민 심사 API
3. 프론트: 사이드바 재구성, App.tsx 라우트 복원, PublishBar 상태 대응
4. 프론트: 어드민 테마 심사 페이지
5. 프론트: 반려 사유 표시 (EditorDashboard, ThemeEditor)

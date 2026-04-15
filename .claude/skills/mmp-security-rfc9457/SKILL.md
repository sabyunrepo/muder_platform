---
name: mmp-security-rfc9457
description: MMP v3 보안 체크리스트. AppError + RFC 9457 Problem Details, WS 토큰 쿼리 파라미터, OWASP Top 10, auditlog, snapshot redaction, sqlc 파라미터 바인딩. 인증·권한·에러 경로·민감 데이터 직렬화 변경 시 필수.
---

# mmp-security-rfc9457 — 보안 체크리스트

## 왜
프로젝트는 RFC 9457 Problem Details와 중앙 AppError 레지스트리를 표준으로 삼는다. 내부 에러 메시지·토큰·개인정보 누출은 즉시 Blocker다. 아래 체크리스트는 생성-검증 패턴의 "검증" 기준이다.

## 에러 응답 (RFC 9457)

필수 필드:
```json
{
  "type": "https://mmp.example/errors/<code>",
  "title": "사용자 가독 요약",
  "status": 400,
  "detail": "구체 맥락(내부 스택 금지)",
  "instance": "/sessions/<id>",
  "code": "<ERR_CODE>"
}
```
- `detail`에 SQL, 경로, 스택 절대 포함 금지.
- `code`는 중앙 레지스트리에 등록된 값만.

## AppError 레지스트리
- 신규 코드는 `apps/server/internal/apperror/codes.go`에 등록.
- 인라인 문자열 에러 금지 (`errors.New("tx failed")` 같은 것).
- `errors.Is/As`로만 분기, 문자열 비교 금지.

## 인증·토큰

| 체크 | 기준 |
|------|------|
| WS 인증 | `?token=` 쿼리 파라미터만. Authorization 헤더 사용 금지. |
| 토큰 로깅 | zerolog 필드에서 절대 직접 출력 금지. 마스킹 헬퍼 경유. |
| 세션 쿠키 | Secure + HttpOnly + SameSite=Lax 이상. |
| 재인증 | 권한 변경·민감 액션 전에 재검증. |

## Redaction (스냅샷/복구)
세션 스냅샷, 복구 페이로드, asynq 작업 페이로드에서 다음 필드 제거·마스킹:
- `token`, `accessToken`, `refreshToken`
- `password`, `hash`
- 이메일·전화번호 원문 (마스킹 허용)
- 내부 파일 경로, 서버 hostname

직렬화 전 redact 함수 통과 강제. 테스트로 회귀 방지.

## 입력 검증
- 모든 handler 경계에서 struct 태그 기반 + 커스텀 validator.
- SQL은 sqlc 파라미터 바인딩만. 문자열 조립·`fmt.Sprintf` 금지.
- 파일 업로드: MIME 화이트리스트 + 크기 제한 + 경로 정규화.

## OWASP Top 10 (우선 점검)
- **A01 Broken Access Control**: 리소스 소유권·역할 체크.
- **A02 Cryptographic Failures**: 비밀번호 bcrypt/argon2, 토큰 만료.
- **A03 Injection**: sqlc 파라미터만, shell exec 금지.
- **A07 Auth Failures**: 레이트 리밋, 로그인 시도 감사.
- **A08 Data Integrity**: 의존성 CVE 스캔, lock 파일 커밋 확인.

## 감사 로그 (auditlog)
다음 이벤트는 반드시 기록:
- 로그인/로그아웃, 비밀번호 변경
- 권한·역할 변경
- 관리자 액션(세션 강제 종료, 사용자 차단)
- 에디터 게시 심사 결정

기록 필드: `actor_id`, `action`, `target`, `ip`, `ua`, `ts`, `result`.

## 의존성
- `go.mod`, `pnpm-lock.yaml` 신규/업그레이드 발견 시 CVE 체크.
- 라이선스 검증(상용 프로젝트라면).

## 출력 포맷
검토 결과는 다음 구조로:
```
## 발견
- [Critical|High|Medium|Low] path:line — 이슈 — 권장 조치
## 통과
- 확인한 체크리스트 항목 목록
## Blocker
- 머지 전 필수 해결 항목 (없으면 "없음")
```

## 체크리스트
- [ ] 새 에러가 AppError 레지스트리에 등록
- [ ] 응답이 RFC 9457 필드 준수
- [ ] 토큰이 로그·스냅샷·에러 detail에 없음
- [ ] SQL이 sqlc 파라미터 바인딩
- [ ] auditlog 대상 이벤트 모두 기록
- [ ] 신규 의존성 CVE 확인

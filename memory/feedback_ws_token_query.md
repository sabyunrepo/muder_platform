---
name: WS 연결 시 토큰 쿼리 파라미터 필수
description: WebSocket 업그레이드에서 JWTPlayerIDExtractor가 ?token= 쿼리로 인증, Authorization 헤더 아님
type: feedback
---
WS 연결 시 토큰을 URL 쿼리 파라미터로 전달해야 함.

**Why:** 서버의 `JWTPlayerIDExtractor`가 `r.URL.Query().Get("token")`으로 JWT를 읽음. WebSocket은 브라우저에서 Authorization 헤더를 보낼 수 없어서 쿼리 파라미터 방식 사용.

**How to apply:** connectionStore.ts에서 `new WebSocket(url)` 호출 시 `?token=${encodeURIComponent(token)}` 추가. 게임/소셜 WS 모두 동일.

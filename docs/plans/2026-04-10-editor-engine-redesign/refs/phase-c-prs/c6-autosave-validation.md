# PR C-6: Auto-Save + Validation 통합

> Phase C | 의존: C-1~C-5 | Wave: W3

---

## 목표
기존 `useAutoSave`를 StudioLayout에 통합.
ConfigSchema 기반 client-side 검증 + 서버 검증 연동.

## 변경 파일

**수정**
```
apps/web/src/features/editor/
  components/StudioLayout.tsx          # useAutoSave 통합
  hooks/useAutoSave.ts                # 확장: version 충돌 감지
  components/Footer/EditorFooter.tsx  # validation status
```

**신규**
```
apps/web/src/features/editor/
  hooks/useThemeValidation.ts         # client + server 검증 통합
```

## Auto-Save 흐름

```
[사용자 변경] → dirty → debounce(5s) → saving → saved/idle
                                           ↓ error
                                        [재시도 버튼]
```

## 검증 2단계

1. **Client-side** (실시간): Zod schema (ConfigSchema → 변환)
   - 폼 필드별 에러 → inline 표시
   - EditorFooter에 전체 error count

2. **Server-side** (요청 시): `POST /v1/editor/themes/{id}/validate`
   - 캐릭터 수, 범인 지정, 맵/단서 필수 여부

## Version 충돌 감지

- 서버 응답 `version`과 local version 비교
- 충돌 시 모달: "다른 세션에서 수정되었습니다. 덮어쓰시겠습니까?"
- 덮어쓰기 → local version 업데이트 후 재저장

## 테스트

- `useThemeValidation.test.ts`: client 검증, server 검증, 에러 매핑
- `useAutoSave.test.ts` (확장): version 충돌 감지, 덮어쓰기

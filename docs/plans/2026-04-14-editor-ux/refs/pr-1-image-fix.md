# PR-1: 이미지 업로드 400 fix

> Phase 14.0 | Wave 1 | 의존: 없음

---

## 문제

`POST /images/upload-url` 호출 시 400 에러:
`"invalid JSON: invalid UUID length: 0"`

**원인**: `imageApi.ts`의 `uploadImage()` 함수에서 `target_id`가 빈 문자열일 때
Go 백엔드가 빈 문자열을 UUID로 파싱 시도 → 실패.

**발생 케이스**:
1. `CoverImageCropUpload`: target="cover"인데 `target_id` 처리 로직 확인 필요
2. 생성 모드에서 아직 ID 없는 엔티티에 이미지 업로드 시도

---

## 변경 파일

| 파일 | 변경 |
|------|------|
| `imageApi.ts` | `target_id` 빈 문자열/undefined 방어 |
| `CoverImageCropUpload.tsx` | PNG → WebP 출력 (크기 최적화) |
| `ImageCropUpload.tsx` | PNG → WebP 출력 |
| `ClueForm.tsx` | 생성 모드 staged upload 패턴 검증 |

---

## Task 목록

1. **imageApi.ts 방어 코드 추가**
   - `uploadImage()`: `targetId`가 falsy이면 `target_id` 필드 생략
   - `target !== "cover"` 조건에 `&& targetId` 추가
   ```ts
   ...(target !== "cover" && targetId ? { target_id: targetId } : {}),
   ```

2. **CoverImageCropUpload WebP 전환**
   - `contentType`를 `image/webp`로 변경
   - `getCroppedBlob()` quality 0.85
   - 브라우저 WebP 미지원 시 JPEG 폴백

3. **ImageCropUpload WebP 전환**
   - 동일하게 WebP 전환
   - `CANVAS_OUTPUT_SIZE` 512 유지

4. **수동 QA 검증**
   - 커버 이미지 업로드 → 200 OK
   - 캐릭터 아바타 업로드 → 200 OK
   - 단서 생성 + 이미지 동시 → staged upload 정상

---

## 테스트

- `imageApi.test.ts` (신규): uploadImage 빈 targetId 시 target_id 미전송 확인
- 수동: 브라우저에서 각 이미지 업로드 플로우 확인

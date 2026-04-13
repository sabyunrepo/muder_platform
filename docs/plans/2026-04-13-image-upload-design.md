# 이미지 업로드 + 크롭 설계

> 날짜: 2026-04-13
> 상태: 승인됨

## 목표

1. 캐릭터 프로필 이미지: 프론트 크롭(1:1) → R2 업로드
2. 단서 이미지: 원본 그대로 R2 업로드
3. 로컬 dev 환경에서도 동작하도록 로컬 파일 스토리지 폴백

## 업로드 플로우

기존 미디어(오디오) 3단계 presigned URL 플로우 재사용:

1. `POST /v1/editor/themes/{id}/images/upload-url` → presigned PUT URL 반환
2. 프론트에서 presigned URL로 직접 PUT (R2 또는 로컬)
3. `POST /v1/editor/themes/{id}/images/confirm` → image_url 자동 설정

## R2 키 형식

- 캐릭터: `themes/{themeId}/characters/{charId}/avatar.{ext}`
- 단서: `themes/{themeId}/clues/{clueId}/image.{ext}`

## 백엔드

- 이미지 전용 엔드포인트 (미디어 오디오와 분리)
- MIME 검증: image/jpeg, image/png, image/webp
- confirm 시 해당 캐릭터/단서 image_url 자동 업데이트
- 로컬 dev: R2 미설정 시 로컬 파일 스토리지 폴백 (tmp/uploads/)

## 프론트엔드

- ImageCropUpload 컴포넌트: react-image-crop, 1:1 비율, canvas Blob 추출
- ImageUpload 컴포넌트: 단서용, 파일 선택 + 미리보기, 크롭 없음
- CharacterForm에 크롭 업로더 통합
- 단서 편집 UI에 이미지 업로더 통합

## 의존성

- 프론트: react-image-crop
- 백엔드: 기존 R2 인프라 재사용

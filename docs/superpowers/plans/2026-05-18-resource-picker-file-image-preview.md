# ResourcePicker file image preview recovery

## Goal

ResourcePicker should show image thumbnails for file-backed media that do not have a public `media.url`, using the same editor download-url contract already used by MediaCard and ImageMediaReferenceField.

Issue: #611

## Constraints

- Keep ResourcePicker presentational; storage/download logic stays in MediaPicker/mediaApi.
- Do not change selection behavior or media filtering.
- Query download URLs only for file image media without a direct URL.

## Coverage Plan

- `apps/web/src/features/editor/mediaApi.test.ts`
  - Cover batched download-url hook calls for multiple media ids.
- `apps/web/src/features/editor/components/media/__tests__/MediaPicker.test.tsx`
  - Cover ResourcePicker thumbnails receiving download URLs for file image media without `url`.

## Checklist

- [x] Add reusable multi-download-url hook in `mediaApi`.
- [x] Use it in `MediaPicker` to fill `thumbnailUrl` for private file images.
- [x] Add focused tests for the fixed behavior.
- [x] Run focused tests and typecheck.
- [x] Run local quick validation.
- [x] Create issue.
- [ ] Create PR, clear review, merge, and return to latest `main`.

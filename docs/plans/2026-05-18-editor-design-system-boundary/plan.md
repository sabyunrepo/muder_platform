# Issue 626 - Editor Design System Boundary

## 목표

`npx getdesign@latest add notion`으로 생성된 `DESIGN.md`를 후속 에디터 재설계의 기준으로 보존하고, 실제 스타일 적용은 `/editor` route 내부로만 제한한다.

## 작업 체크리스트

- [x] `npx getdesign@latest add notion` 실행 및 `DESIGN.md` 생성 확인
- [x] `DESIGN.md`의 Notion token/source 원안 보존
- [x] editor-only wrapper class 도입
- [x] editor-only CSS variable namespace 추가
- [x] 후속 #627에서 사용할 class name helper 추가
- [x] 원안 대비 deviation 문서화
- [x] typecheck/build/focused test 검증
- [ ] PR review 및 merge

## 완료 조건 매핑

- 사용자 경험: 후속 재설계자가 어떤 토큰과 class layer를 써야 하는지 `apps/web/src/features/editor/design-system/README.md`만 보고 알 수 있다.
- 디자인 기준: `DESIGN.md`는 원본 그대로 보존하고, 적용 가능한 색상/spacing/radius/shadow를 editor namespace 변수로 추출했다.
- 경계: `EditorPage`에서만 CSS를 import하고 `mmp-editor-design-scope` wrapper를 적용한다.
- 회귀 방지: selector는 전부 `.mmp-editor-design-scope ...` 아래에 있어 `/editor` 밖 route에는 적용되지 않는다.

## #627 인계

#627은 기존 화면을 실제로 재설계하는 단계다. 이때 전역 `index.css`나 shared UI를 먼저 바꾸지 말고, `editorDesignClassNames`와 `editorNotionTheme.css`를 기준으로 에디터 컴포넌트부터 순차 적용한다.

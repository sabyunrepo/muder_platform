# Rich Media Block UX

## 고정 결정

- `MediaEmbed` 저장 포맷은 `<MediaEmbed mediaId="..." type="..." align="..." width="..." />`를 유지한다.
- 이미지/영상은 텍스트 안에 섞이는 inline 이미지가 아니라 선택 가능한 block으로 다룬다.
- 빈 문단을 markdown에 억지로 저장하지 않는다. 제작자가 체감하는 간격 조절은 위/아래 삽입 컨트롤과 블록 이동 컨트롤로 제공한다.

## Coverage Plan

- `mediaEmbedMarkdown.ts`
  - MediaEmbed snippet 생성이 블록 앞뒤 줄바꿈을 보존한다.
  - 대상 MediaEmbed 앞/뒤에 문단 입력 지점을 추가한다.
  - 대상 MediaEmbed를 위/아래 MediaEmbed와 순서 교체한다.
  - 대상이 없거나 이동할 이웃 블록이 없으면 원문을 유지한다.
- `MediaEmbedEditor.tsx`
  - 선택 가능한 group 역할과 키보드 조작 안내가 노출된다.
  - 위/아래 문단 추가, 위/아래 이동, 교체, 삭제 버튼이 구분된다.
  - M/L 텍스트 버튼은 본문처럼 보이지 않게 아이콘 기반으로 정리한다.
- `RichContentEditor.tsx`
  - MediaEmbed 조작은 `onChange`를 통해 기존 자동저장 흐름에 연결된다.
  - 외부 markdown 동기화는 값이 실제로 달라질 때만 `setMarkdown`을 호출한다.

## 작업 체크리스트

- [x] Issue #616과 workflow seed 생성
- [x] markdown helper 추가
- [x] MediaEmbed block control UI 추가
- [x] focused unit/component test 추가
- [x] typecheck/E2E focused 검증
- [ ] PR 생성, CodeRabbit 확인, merge

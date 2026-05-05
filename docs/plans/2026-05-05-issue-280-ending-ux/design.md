# Issue #280 — 캐릭터별 결말·감상 공유·GM 보정 설계

## 원인

현재 MMP는 기본 종료 화면에서 `voting.lastResult`와 `ending_branch.result`를 읽어 결말 제목과 투표 집계를 보여준다. 제작자 에디터도 `flow_nodes(type=ending)` 기반 결말 목록과 `config_json.modules.ending_branch` 분기 규칙을 이미 다룬다.

남은 문제는 결말 UX가 여러 책임을 한 번에 품고 있다는 점이다.

- 공통 결말 본문: 모든 플레이어에게 공개되는 최종 이야기.
- 캐릭터별 결말/엔드카드: 특정 PC/NPC/역할에 맞춘 후일담.
- 감상 공유: 플레이 후 다시 읽고 대화할 수 있는 공개 화면.
- GM 보정: 진행자가 결과를 수동으로 고치는 권한 있는 runtime 액션.

이 네 가지를 한 PR에서 구현하면 frontend display, backend redaction, runtime override, audit 정책이 동시에 섞인다. 그래서 #280은 구현보다 정책과 PR 분할을 먼저 고정해야 한다.

## 외부 사례에서 가져올 패턴

- Articy:draft는 조건과 지시를 flow 안에서 테스트하고, 조건 충족 여부로 narrative branch를 제어한다. MMP에 그대로 script editor를 노출하지 않고, `ending_branch` 엔진이 조건 판정을 맡고 에디터는 제작자용 입력 폼을 제공해야 한다. 근거: https://www.articy.com/help/adx/Scripting_in_articy.html
- Ink는 story flow가 branching/divert를 통해 여러 결말로 도달하고 `END`로 종료된다. MMP도 결말을 “결과 화면 텍스트”가 아니라 flow/runtime이 도달하는 node로 유지하는 편이 맞다. 근거: https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md
- ChoiceScript achievement 문서는 hidden/visible, pre/post description처럼 공개 전후 문구를 분리한다. MMP의 감상 공유와 엔드카드도 스포일러 공개 전/후 필드를 분리해야 한다. 근거: https://www.choiceofgames.com/make-your-own-games/achievements-in-choicescript/

Uzu 문서는 repo의 `docs/uzu-studio-docs`에서 로컬로 확인했다. 감상 공유 화면은 토론, 투표, 엔딩 이후 표시되는 해설/결과 화면이며, 탭마다 제목, 설명, 본문을 입력하고 투표 결과나 미획득 단서 목록을 선택적으로 배치할 수 있다. 또한 v2 문서에는 감상 공유 화면에서 배포할 엔딩과 배포하지 않을 엔딩을 작가가 제어할 수 있고, 모든 엔딩을 공개하려면 감상 공유 시작 시 배포하거나 별도 탭에 옮겨 적는 방식이 제시되어 있다.

MMP는 이 구조를 그대로 복제하지 않는다. Uzu의 “작가가 감상 공유에 무엇을 공개할지 제어한다”는 원칙만 가져오고, 실제 source of truth는 MMP의 `ending_branch.result`, `flow_nodes(type=ending)`, Character entity, runtime redaction adapter로 나눈다.

## 결과

결말 UX의 source of truth는 다음처럼 나누는 것이 유지보수에 가장 좋다.

| 영역 | Source of truth | 제작자 UI | Runtime/Game UI |
| --- | --- | --- | --- |
| 결말 판정 | `ending_branch.result` | 분기 규칙 요약과 default ending 선택 | 엔진이 확정한 selected ending 표시 |
| 공통 결말 본문 | `flow_nodes(type=ending).data.endingContent` | 결말 상세에서 Markdown/요약 편집 | RESULT 화면 본문 |
| 캐릭터별 엔드카드 | Character entity 확장 + result adapter | 캐릭터 상세 또는 엔드카드 섹션 | 내 캐릭터/공개 허용 카드만 표시 |
| 감상 공유 | Ending UX 설정 | 공개 탭 on/off, 공개 문구 | RESULT 이후 읽기 전용 탭 |
| GM 보정 | 별도 privileged action + audit | 이슈 #280 후속 | GM 화면에서만 실행 |

## 권장

### ⭐ 권장안: 3단계 분할

1. #280-A: Editor/result UI MVP
   - 결말 상세에 “결과 화면 공개 본문”, “감상 공유 공개 여부”, “플레이어에게 보일 짧은 요약”만 추가한다.
   - RESULT 화면은 `selectedEnding` id를 결말 node의 label/content와 매핑해 보여준다.
   - GM override는 버튼을 만들지 않는다.

2. #293: Runtime 계약 cleanup
   - ending node 삭제 시 `ending_branch.defaultEnding`과 matrix의 dangling ending id를 cleanup 또는 validation한다.
   - runtime이 flow node content를 직접 읽는지, adapter가 resolve하는지 문서와 테스트로 고정한다.

3. #330/#280-B: 캐릭터별 확장과 GM 보정
   - 캐릭터별 엔드카드는 Character entity 소유로 두고 result screen에서 읽는다.
   - GM 보정은 권한, 감사 로그, 재평가 이벤트, 플레이어 알림 정책이 필요하므로 별도 PR로 둔다.

## 보류할 결정

- GM이 결말을 바꿀 수 있는 시점: 결과 공개 전만 허용할지, 공개 후 정정까지 허용할지 사용자 결정이 필요하다.
- 감상 공유 탭의 범위: 공통 결말만 보여줄지, 캐릭터별 엔드카드까지 같이 보여줄지 UX 확인이 필요하다.
- 투표 결과 공개 수준: 집계만 유지할지, 역할별/캐릭터별 요약을 허용할지 #280-B에서 결정한다.

## 후속 이슈 반영

- #293은 닫혔으며, 결말 id/content runtime 계약 cleanup은 #280-A 전에 선행 완료된 기준으로 본다.
- #330은 닫혔으며, 엔드카드 소유권은 Character entity 쪽으로 좁히고 result UX에서 표시하는 방향으로 정리된 기준을 따른다.
- #329는 닫혔으며, 조건부 이름/아이콘은 엔드카드보다 더 넓은 redaction 문제로 분리 처리된 기준을 따른다.
- #280 본 이슈는 이제 구현 PR을 만들기보다, 위 기준을 바탕으로 후속 구현 이슈를 연결하고 닫는 설계 기준선 역할로 마무리한다.

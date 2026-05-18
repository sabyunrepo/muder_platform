import { describe, expect, it } from 'vitest';

import { resolveRoleSheetDraftSync } from './useRoleSheetEditorState';

describe('resolveRoleSheetDraftSync', () => {
  it('keeps a dirty local draft when the same document is refetched with another body', () => {
    const result = resolveRoleSheetDraftSync({
      currentDraft: '작성 중인 로컬 초안',
      currentServerBaseline: '기존 서버 본문',
      currentDocumentIdentity: 'char-1:markdown:doc-1',
      nextServerBody: '서버에서 다시 내려온 본문',
      nextDocumentIdentity: 'char-1:markdown:doc-1',
    });

    expect(result).toEqual({
      nextDraft: '작성 중인 로컬 초안',
      nextServerBaseline: '서버에서 다시 내려온 본문',
      nextDocumentIdentity: 'char-1:markdown:doc-1',
      shouldReplaceDraft: false,
      shouldResetSaveStatus: false,
    });
  });

  it('accepts a refetched body when the local draft is clean', () => {
    const result = resolveRoleSheetDraftSync({
      currentDraft: '기존 서버 본문',
      currentServerBaseline: '기존 서버 본문',
      currentDocumentIdentity: 'char-1:markdown:doc-1',
      nextServerBody: '서버에서 갱신된 본문',
      nextDocumentIdentity: 'char-1:markdown:doc-1',
    });

    expect(result).toMatchObject({
      nextDraft: '서버에서 갱신된 본문',
      shouldReplaceDraft: true,
      shouldResetSaveStatus: true,
    });
  });

  it('loads the new body when the role sheet document identity changes', () => {
    const result = resolveRoleSheetDraftSync({
      currentDraft: '저장 전 로컬 초안',
      currentServerBaseline: '기존 서버 본문',
      currentDocumentIdentity: 'char-1:markdown:doc-1',
      nextServerBody: '다른 캐릭터 역할지',
      nextDocumentIdentity: 'char-2:markdown:doc-2',
    });

    expect(result).toMatchObject({
      nextDraft: '다른 캐릭터 역할지',
      shouldReplaceDraft: true,
      shouldResetSaveStatus: true,
    });
  });
});

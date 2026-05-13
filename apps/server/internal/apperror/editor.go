package apperror

import "net/http"

func EditorEntityLoadFailed(entity string) *AppError {
	return New(ErrEditorEntityLoadFailed, http.StatusInternalServerError, "failed to load editor entity").
		WithUserMessage(entity + " 불러오기에 실패했습니다. 잠시 후 다시 시도해주세요.").
		WithParams(editorEntityParams(entity, "load"))
}

func EditorEntitySaveFailed(entity string) *AppError {
	return New(ErrEditorEntitySaveFailed, http.StatusInternalServerError, "failed to save editor entity").
		WithUserMessage(entity + " 저장에 실패했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해주세요.").
		WithParams(editorEntityParams(entity, "save"))
}

func EditorEntityDeleteFailed(entity string) *AppError {
	return New(ErrEditorEntityDeleteFailed, http.StatusInternalServerError, "failed to delete editor entity").
		WithUserMessage(entity + " 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.").
		WithParams(editorEntityParams(entity, "delete"))
}

func editorEntityParams(entity, action string) map[string]any {
	return map[string]any{
		"entity": entity,
		"action": action,
	}
}

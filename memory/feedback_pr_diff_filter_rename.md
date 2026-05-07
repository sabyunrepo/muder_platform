---
name: git diff --diff-filter는 AMR 사용 (rename 우회 차단)
description: PR diff 검사 CI 작성 시 `--diff-filter=AM`은 rename(R) 제외. rename 우회를 막으려면 AMR로 R 포함.
type: feedback
---

PR diff에서 변경된 파일 목록을 추출할 때 `git diff --name-only --diff-filter=AM`은 rename(R) 파일을 제외한다. PR review CI는 중요한 파일이 rename된 경우 검사를 우회할 수 있어 **`AMR` 사용 필수**.

**Why**: Git의 `--diff-filter`는 status code 기반 (`A` Added, `M` Modified, `R` Renamed, `D` Deleted, ...). rename detection은 `-M`/`--find-renames` (Git 2.9+ 기본)로 활성화되어 "Rnnn oldpath newpath" 라인을 만드는데, `AM` filter는 R을 제외한다. 즉 중요한 파일을 다른 경로로 rename하면 PR diff 검사에서 누락될 수 있다. PR #184의 과거 file-size guard 구현에서 CodeRabbit이 같은 패턴을 잡아 `AMR`로 수정했다.

**How to apply**:
1. **PR diff 검사 CI** (lint scope 검사 / migration scope 검사 등):
   ```yaml
   # OK
   changed=$(git diff --name-only --diff-filter=AMR "$BASE_SHA" "$HEAD_SHA")

   # NG (rename 우회 가능)
   changed=$(git diff --name-only --diff-filter=AM "$BASE_SHA" "$HEAD_SHA")
   ```

2. **포함 status code 결정 가이드**:
   - `A` Added — 무조건 포함
   - `M` Modified — 무조건 포함
   - `R` Renamed (with or without modification) — **PR scope 검사에는 포함 권장**
   - `C` Copied — 보통 포함
   - `D` Deleted — 검사 종류에 따라. 보안 검사는 포함 가능
   - `T` Type change (file → symlink 등) — 보통 포함

3. PR review 체크리스트: "PR diff 검사 CI workflow 추가/수정 시 `--diff-filter`에 `R` 포함 여부 확인" — `feedback_code_review_patterns.md` CI 섹션.

**예시**:
```yaml
- name: Inspect changed files
  run: |
    # --diff-filter=AMR: include Added, Modified, and Renamed
    # (including pure renames and rename+modify cases)
    # so renames do not bypass PR diff checks.
    changed=$(git diff --name-only --diff-filter=AMR "$BASE_SHA" "$HEAD_SHA" || true)
```

**관련 PR**: #184 round-3 (CR-1 fix, commit 7aacc3e).

**관련 카논**: `feedback_file_size_limit.md` (한도 정의는 거기, 검사 방법은 본 파일).

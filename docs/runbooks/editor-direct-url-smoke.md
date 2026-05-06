# Editor Direct URL Smoke

이 문서는 로컬에서 실제 제작자 에디터 URL이 열리는지 확인하는 최소 절차다.

## 샘플 테마 seed

`e2e-test-theme`는 UUID가 아니라 slug다. 로컬 DB에 샘플 테마가 없으면 `/editor/e2e-test-theme`는 테마 없음 화면을 보여준다.

```bash
psql "$DATABASE_URL" -f apps/server/db/seed/e2e-themes.sql
```

개발 compose 기본 DB를 직접 사용할 때는 다음처럼 접속값을 명시한다.

```bash
PGPASSWORD=mmp_dev psql -h localhost -p 25432 -U mmp -d mmf -f apps/server/db/seed/e2e-themes.sql
```

## Smoke URL

아래 URL은 같은 테마 locator에 대해 기본 진입과 주요 탭이 올바르게 열리는지 확인한다. `{theme}`에는 실제 UUID 또는 `e2e-test-theme` 같은 slug를 넣을 수 있다.

```text
http://localhost:3000/editor/{theme}
http://localhost:3000/editor/{theme}/flow
http://localhost:3000/editor/{theme}/story
http://localhost:3000/editor/{theme}/info
http://localhost:3000/editor/{theme}/characters
http://localhost:3000/editor/{theme}/clues
http://localhost:3000/editor/{theme}/locations
http://localhost:3000/editor/{theme}/endings
http://localhost:3000/editor/{theme}/media
```

`/flow`는 제작 흐름의 기본 스토리 진행 화면으로 들어가는 짧은 주소다. 세부 설계 탭의 흐름 하위 화면을 직접 열려면 `/editor/{theme}/design/flow`를 사용한다.

# PR-6 Migration 00026 — Up/Down Smoke 절차서

> ⚠️ **Forward-only migration**: Down 은 user-only 감사 행을 돌이킬 수 없이 `DELETE` 한다.
> production 에서는 원칙적으로 Down 을 실행하지 말 것. 반드시 롤백해야 하는 상황이면
> 아래 "Down 리스크" 섹션의 archive 절차를 **사전에** 수행하고 DBA 승인 후에만 진행.

## 개요

`apps/server/db/migrations/00026_auditlog_expansion.sql` 은 `audit_events` 테이블에 다음 변경을 가한다.

- `session_id` / `seq` NOT NULL 해제 (NULLABLE)
- `user_id UUID` 컬럼 추가
- 부분 UNIQUE 인덱스 `audit_events_session_seq_key` (session_id IS NOT NULL 행만)
- 사용자 조회 인덱스 `idx_audit_events_user`
- CHECK 제약 `audit_events_identity_required` (session_id IS NOT NULL OR user_id IS NOT NULL)

## 🔴 Down 리스크

**Down 시 `DELETE FROM audit_events WHERE session_id IS NULL` 실행 →
이 migration 이후에 기록된 user-only 감사 행(auth/admin/review/editor 이벤트)이
전부 소실된다.**

롤백 직전 반드시 아래 백업을 실행할 것:

```bash
pg_dump --table=audit_events -F c -f audit_events_backup_$(date +%Y%m%d%H%M%S).dump "$DATABASE_URL"
```

## 로컬 Smoke 실행 절차

### 전제 조건

```bash
# 테스트 DB 컨테이너 기동 (Makefile target 확인)
make db-test-up        # 또는 아래 직접 실행
docker compose -f docker/docker-compose.test.yml up -d postgres
```

### 환경 변수

```bash
export TEST_DB_DSN="postgres://postgres:postgres@localhost:5433/mmp_test?sslmode=disable"
```

### Up 실행

```bash
goose -dir apps/server/db/migrations postgres "$TEST_DB_DSN" up
```

기대 결과:

```
OK   00026_auditlog_expansion.sql
goose: successfully migrated database to version: 26
```

### 상태 확인

```bash
goose -dir apps/server/db/migrations postgres "$TEST_DB_DSN" status
```

`audit_events` 테이블 스키마 확인:

```sql
\d audit_events
-- session_id: uuid (nullable)
-- seq: bigint (nullable)
-- user_id: uuid (nullable)
-- 인덱스: audit_events_session_seq_key (partial), idx_audit_events_user
-- CHECK: audit_events_identity_required
```

### Down 실행 (롤백)

```bash
# 반드시 백업 먼저
pg_dump --table=audit_events -F c -f audit_events_backup.dump "$TEST_DB_DSN"

goose -dir apps/server/db/migrations postgres "$TEST_DB_DSN" down
```

기대 결과:

```
OK   00026_auditlog_expansion.sql
goose: successfully migrated database to version: 25
```

### Up → Down → Up 순환 무결성 확인

```bash
goose -dir apps/server/db/migrations postgres "$TEST_DB_DSN" up   # → v26
goose -dir apps/server/db/migrations postgres "$TEST_DB_DSN" down # → v25
goose -dir apps/server/db/migrations postgres "$TEST_DB_DSN" up   # → v26 (재적용)
```

세 명령 모두 오류 없이 완료되면 smoke 통과.

## CI / Staging 체크리스트

- [ ] staging DB에 00026 Up 적용 전 `pg_dump --table=audit_events` 백업 실행
- [ ] `goose status` 로 현재 버전 확인 (25여야 함)
- [ ] `goose up` 실행 및 로그 보존
- [ ] 적용 후 `audit_events_identity_required` CHECK 제약 활성화 확인:
  ```sql
  SELECT conname FROM pg_constraint WHERE conrelid = 'audit_events'::regclass;
  ```
- [ ] 롤백이 필요한 경우: Down 실행 **직전** 아래 archive 쿼리로 user-only 행을 별도 테이블에 보존:
  ```sql
  CREATE TABLE audit_events_userrows_archive_00026 AS
    SELECT * FROM audit_events WHERE session_id IS NULL;
  SELECT COUNT(*) FROM audit_events_userrows_archive_00026;
  -- 이 archive 테이블은 forward 재적용 후에도 읽기 전용 참조용으로 보존
  ```
  이후 `goose down` 실행. 재적용 후 archive 에서 복원이 필요하면 DBA 승인 수반.

## 참고: Down 절 로직

```sql
-- Down에서 실행되는 위험 구문:
DELETE FROM audit_events WHERE session_id IS NULL;
```

이 시점에 user_id 컬럼만 가진 행(auth/admin/review/editor 감사 이벤트)은
**복구 불가능하게 삭제**된다. staging rollback 전 담당자 확인 필수.

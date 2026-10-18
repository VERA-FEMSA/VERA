#!/usr/bin/env bash
set -euo pipefail

# This rehearsal is deliberately restricted to an ephemeral GitHub-hosted runner.
if [[ "${GITHUB_ACTIONS:-}" != "true" || "${RUNNER_OS:-}" != "Linux" ]]; then
  echo "Run this only in the isolated GitHub Actions Linux workflow." >&2
  exit 2
fi

cli=(npx --yes supabase@2.121.0)
started_ms=$(date +%s%3N)
start_log="${RUNNER_TEMP}/vera-local-supabase-start.log"
reset_log="${RUNNER_TEMP}/vera-local-supabase-reset.log"

echo "Starting a disposable local Supabase instance; no linked project is used."
if ! "${cli[@]}" start --exclude realtime,imgproxy,studio,postgres-meta,logflare,vector,mailpit,edge-runtime,supavisor >"$start_log" 2>&1; then
  echo "Local Supabase failed to start. Diagnostic lines without key material:" >&2
  grep -viE 'key|token|secret|password' "$start_log" | tail -n 20 >&2 || true
  exit 1
fi

echo "Replaying all versioned migrations against the disposable database."
if ! "${cli[@]}" db reset --local >"$reset_log" 2>&1; then
  echo "Local migration replay failed. Diagnostic lines without key material:" >&2
  grep -viE 'key|token|secret|password' "$reset_log" | tail -n 30 >&2 || true
  exit 1
fi
migrated_ms=$(date +%s%3N)

container="supabase_db_vera"
if [[ -z "$(docker ps -q --filter "name=^/${container}$")" ]]; then
  echo "The disposable PostgreSQL container was not found." >&2
  exit 1
fi

sql() {
  docker exec "$container" psql -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 -c "$1"
}

expected_migrations=$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')
applied_migrations=$(sql 'select count(*) from supabase_migrations.schema_migrations;')
if [[ "$applied_migrations" != "$expected_migrations" ]]; then
  echo "Migration mismatch: ${applied_migrations}/${expected_migrations}." >&2
  exit 1
fi

tables=(
  logins vera_audit_proposals vera_users vera_risks vera_controls vera_evidence
  vera_audit_comments vera_audit_events vera_findings vera_notification_reads
  vera_evidence_text_chunks vera_ai_feedback
)
for table in "${tables[@]}"; do
  rls=$(sql "select coalesce((select relrowsecurity::int::text from pg_class where oid=to_regclass('public.${table}')), 'missing');")
  if [[ "$rls" != "1" ]]; then
    echo "Missing table or disabled RLS: public.${table}." >&2
    exit 1
  fi
  direct_access=$(sql "select has_table_privilege('anon','public.${table}','SELECT,INSERT,UPDATE,DELETE')::int + has_table_privilege('authenticated','public.${table}','SELECT,INSERT,UPDATE,DELETE')::int;")
  if [[ "$direct_access" != "0" ]]; then
    echo "Unexpected client-role grants: public.${table}." >&2
    exit 1
  fi
done

bucket=$(sql "select count(*) from storage.buckets where id='vera-evidence' and public=false and file_size_limit=3145728;")
if [[ "$bucket" != "1" ]]; then
  echo "Private evidence bucket configuration differs from the migration." >&2
  exit 1
fi

# A disposable row proves the mechanics of a logical data export and import.
# This is not a backup of, or restore from, the production Supabase project.
sql "create table public.vera_qa_restore_probe (id integer primary key, marker text not null); insert into public.vera_qa_restore_probe values (1, 'synthetic-only');" >/dev/null
restore_started_ms=$(date +%s%3N)
docker exec "$container" pg_dump -U postgres -d postgres --data-only --column-inserts --table public.vera_qa_restore_probe >"${RUNNER_TEMP}/vera-qa-restore.sql"
sql 'truncate table public.vera_qa_restore_probe;' >/dev/null
docker exec -i "$container" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 <"${RUNNER_TEMP}/vera-qa-restore.sql" >/dev/null
restored=$(sql "select count(*) from public.vera_qa_restore_probe where id=1 and marker='synthetic-only';")
if [[ "$restored" != "1" ]]; then
  echo "Synthetic restore did not reproduce the expected row." >&2
  exit 1
fi
restore_ms=$(($(date +%s%3N) - restore_started_ms))
sql 'drop table public.vera_qa_restore_probe;' >/dev/null

export VERA_QA_MIGRATIONS="$applied_migrations"
export VERA_QA_TABLES="${#tables[@]}"
export VERA_QA_START_AND_RESET_MS="$((migrated_ms - started_ms))"
export VERA_QA_RESTORE_MS="$restore_ms"
python3 - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

report = {
    "checkedAt": datetime.now(timezone.utc).isoformat(),
    "workflowSha": os.environ.get("GITHUB_SHA"),
    "environment": "GitHub-hosted Ubuntu runner; disposable local Supabase; no linked project",
    "passed": True,
    "migrationsApplied": int(os.environ["VERA_QA_MIGRATIONS"]),
    "privateTablesWithRlsAndNoClientGrants": int(os.environ["VERA_QA_TABLES"]),
    "privateEvidenceBucket": True,
    "syntheticLogicalRestore": True,
    "startAndMigrationReplayMs": int(os.environ["VERA_QA_START_AND_RESET_MS"]),
    "syntheticRestoreMs": int(os.environ["VERA_QA_RESTORE_MS"]),
    "scope": "Schema and synthetic restore rehearsal only; no production persistence, backup, RPO, or load acceptance.",
}
Path("quality-report").mkdir(exist_ok=True)
Path("quality-report/local-supabase-rehearsal.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
summary = (
    "## Local Supabase rehearsal\n\n"
    f"- Result: **PASS**; migrations {report['migrationsApplied']}/{report['migrationsApplied']}\n"
    f"- Private tables with RLS and no anon/authenticated grants: {report['privateTablesWithRlsAndNoClientGrants']}\n"
    "- Private evidence bucket: verified\n"
    f"- Local start and migration replay: {report['startAndMigrationReplayMs']} ms\n"
    f"- Synthetic logical restore: PASS in {report['syntheticRestoreMs']} ms\n"
    "- Scope: disposable local database; no real Supabase production backup or restore.\n"
)
print(summary)
if os.environ.get("GITHUB_STEP_SUMMARY"):
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as output:
        output.write(summary)
PY

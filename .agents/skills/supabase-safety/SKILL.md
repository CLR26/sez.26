# Supabase Safety — SEZ.26

Treat Supabase/Postgres as the source of truth for authentication, authorization, data integrity, archival state, event logging, and KPI reporting.

## Invariants

- case_channel: whatsapp | email
- case_status: new | in_progress | escalated | resolved
- case_category: customs | delivery | billing | account | other
- case_team: mada_ops | sez_ops
- owner_id is immutable
- resolved_at is maintained by the database trigger
- case_events are append-only
- RLS remains enabled
- archived cases use deleted_at/deleted_by
- kpi_report(period_days) is the reporting source

## Safe change rules

Do not disable RLS to solve a frontend problem. Do not add fake-data fallbacks. Do not bypass database triggers from the client. Any SQL change must be explicit, minimal, and compatible with the existing schema/migrations.

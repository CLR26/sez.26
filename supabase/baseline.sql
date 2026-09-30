-- Baseline schema-only derived from read-only inspection of Supabase project SEZ26 (PostgreSQL 17).
-- No application data, auth users, or customer records are included.
-- Recreate in a fresh Supabase project after enabling Supabase platform schemas/extensions.
-- This baseline reflects public application objects; it does not recreate platform-managed auth/storage/realtime schemas.

create type public.case_channel as enum ('whatsapp', 'email');
create type public.case_category as enum ('customs', 'delivery', 'billing', 'account', 'other');
create type public.case_status as enum ('new', 'in_progress', 'escalated', 'resolved');
create type public.case_team as enum ('mada_ops', 'sez_ops');

create table public.agents (
  id uuid primary key references auth.users(id),
  full_name text not null,
  team text not null default 'cs',
  active boolean not null default true
);
alter table public.agents enable row level security;

create table public.cases (
  id bigint generated always as identity primary key,
  subject text not null,
  customer_name text not null,
  customer_contact text,
  channel public.case_channel not null,
  category public.case_category not null,
  status public.case_status not null default 'new',
  owner_id uuid not null references public.agents(id),
  assigned_team public.case_team,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references public.agents(id),
  permanently_deleted_at timestamptz,
  constraint escalated_needs_team check (status <> 'escalated' or assigned_team is not null)
);
alter table public.cases enable row level security;

create table public.case_events (
  id bigint generated always as identity primary key,
  case_id bigint not null references public.cases(id),
  author_id uuid not null references public.agents(id),
  kind text not null check (kind = any (array['note','customer_update','escalation','status_change'])),
  channel public.case_channel,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.case_events enable row level security;

create index cases_status_idx on public.cases using btree (status);
create index cases_created_idx on public.cases using btree (created_at desc);
create index cases_active_idx on public.cases using btree (created_at desc) where deleted_at is null;
create index cases_visible_idx on public.cases using btree (created_at desc) where deleted_at is null and permanently_deleted_at is null;
create index case_events_case_idx on public.case_events using btree (case_id, created_at);

create or replace view public.kpi_cases with (security_invoker = true) as
select category, channel,
       count(*) filter (where status = 'resolved') as resolved_count,
       count(*) filter (where status <> 'resolved') as open_count,
       avg(resolved_at - created_at) filter (where status = 'resolved') as avg_resolution_time
from public.cases
where deleted_at is null and permanently_deleted_at is null
group by category, channel;

create or replace function public.is_active_agent() returns boolean
language sql stable security definer as $$
  select exists (select 1 from public.agents where id = auth.uid() and active);
$$;

create or replace function public.set_resolved_at() returns trigger language plpgsql as $$
begin
  if new.status = 'resolved' and old.status <> 'resolved' then new.resolved_at := now();
  elsif new.status <> 'resolved' then new.resolved_at := null;
  end if;
  return new;
end $$;

create or replace function public.lock_owner() returns trigger language plpgsql as $$
begin
  if new.owner_id <> old.owner_id then raise exception 'owner_id is immutable'; end if;
  return new;
end $$;

create or replace function public.guard_archive() returns trigger language plpgsql as $$
begin
  if new.deleted_at is distinct from old.deleted_at then
    new.deleted_by := case when new.deleted_at is null then null else auth.uid() end;
  end if;
  return new;
end $$;

create or replace function public.guard_case_tombstone() returns trigger language plpgsql
set search_path = public as $$
begin
  if old.permanently_deleted_at is not null
     and new.permanently_deleted_at is distinct from old.permanently_deleted_at then
    raise exception 'A permanently deleted case cannot be restored';
  end if;
  return new;
end $$;

create or replace function public.rls_auto_enable() returns event_trigger
language plpgsql security definer set search_path = pg_catalog as $$
declare cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
    if cmd.schema_name = 'public' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception when others then
        raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    end if;
  end loop;
end $$;

create trigger cases_resolved_at before update on public.cases for each row execute function public.set_resolved_at();
create trigger cases_lock_owner before update on public.cases for each row execute function public.lock_owner();
create trigger cases_guard_archive before update on public.cases for each row execute function public.guard_archive();
create trigger cases_guard_tombstone before update of permanently_deleted_at on public.cases for each row execute function public.guard_case_tombstone();

create policy agents_read on public.agents for select to authenticated using (public.is_active_agent());
create policy cases_select on public.cases for select to authenticated using (public.is_active_agent() and permanently_deleted_at is null);
create policy cases_insert on public.cases for insert to authenticated with check (public.is_active_agent() and owner_id = auth.uid());
create policy cases_update on public.cases for update to authenticated using (public.is_active_agent() and permanently_deleted_at is null) with check (public.is_active_agent() and permanently_deleted_at is null);
create policy events_read on public.case_events for select to authenticated using (
  public.is_active_agent() and exists (select 1 from public.cases c where c.id = case_events.case_id and c.permanently_deleted_at is null)
);
create policy events_add on public.case_events for insert to authenticated with check (
  public.is_active_agent() and author_id = auth.uid() and exists (select 1 from public.cases c where c.id = case_events.case_id and c.permanently_deleted_at is null)
);

create or replace function public.delete_case(target_case_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
declare affected_rows integer;
begin
  if not public.is_active_agent() then raise exception 'Only active agents can delete cases' using errcode = '42501'; end if;
  update public.cases set permanently_deleted_at = now()
    where id = target_case_id and permanently_deleted_at is null;
  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end $$;
revoke all on function public.delete_case(bigint) from public, anon;
grant execute on function public.delete_case(bigint) to authenticated;

create or replace function public.kpi_report(period_days int default 30)
returns table (dimension text, key text, open_count bigint, resolved_count bigint, avg_resolution_seconds double precision)
language sql stable security invoker as $$
  with base as (
    select channel, category, status,
      extract(epoch from (resolved_at - created_at))::double precision as secs,
      (status = 'resolved' and resolved_at >= now() - make_interval(days => period_days)) as resolved_in_period
    from public.cases where deleted_at is null and permanently_deleted_at is null
  )
  select 'all'::text, 'all'::text, count(*) filter (where status <> 'resolved'),
    count(*) filter (where resolved_in_period), avg(secs) filter (where resolved_in_period) from base
  union all
  select 'channel'::text, channel::text, count(*) filter (where status <> 'resolved'),
    count(*) filter (where resolved_in_period), avg(secs) filter (where resolved_in_period) from base group by channel
  union all
  select 'category'::text, category::text, count(*) filter (where status <> 'resolved'),
    count(*) filter (where resolved_in_period), avg(secs) filter (where resolved_in_period) from base group by category;
$$;
# Agent teams

Application access is granted to active agents with Supabase Auth accounts. Case owner is the authenticated creator and cannot be reassigned. This app is not used by Sez Ops: it is external and has no login; the case owner enters its progress manually. Current live team-label mismatch: all four active records have team `cs`, while the application offers Ops Madagascar and Ops Seychelles. See [product rules](../docs/product.md#équipes-comptes-et-responsabilité) before reconciling this value.

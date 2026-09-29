-- Preserve case and event rows while permanently removing deleted cases from application use.
alter table public.cases
  add column if not exists permanently_deleted_at timestamptz;

create index if not exists cases_visible_idx
  on public.cases (created_at desc)
  where deleted_at is null and permanently_deleted_at is null;

create or replace function public.guard_case_tombstone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.permanently_deleted_at is not null
    and new.permanently_deleted_at is distinct from old.permanently_deleted_at then
    raise exception 'A permanently deleted case cannot be restored';
  end if;
  return new;
end;
$$;

drop trigger if exists cases_guard_tombstone on public.cases;
create trigger cases_guard_tombstone
  before update of permanently_deleted_at on public.cases
  for each row execute function public.guard_case_tombstone();

drop policy if exists cases_select on public.cases;
drop policy if exists cases_all on public.cases;
create policy cases_select on public.cases for select to authenticated
  using (public.is_active_agent() and permanently_deleted_at is null);

drop policy if exists cases_update on public.cases;
create policy cases_update on public.cases for update to authenticated
  using (public.is_active_agent() and permanently_deleted_at is null)
  with check (public.is_active_agent() and permanently_deleted_at is null);

drop policy if exists events_read on public.case_events;
create policy events_read on public.case_events for select to authenticated
  using (
    public.is_active_agent()
    and exists (
      select 1 from public.cases c
      where c.id = case_events.case_id and c.permanently_deleted_at is null
    )
  );

drop policy if exists events_add on public.case_events;
create policy events_add on public.case_events for insert to authenticated
  with check (
    public.is_active_agent()
    and author_id = auth.uid()
    and exists (
      select 1 from public.cases c
      where c.id = case_events.case_id and c.permanently_deleted_at is null
    )
  );

create or replace function public.delete_case(target_case_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer;
begin
  if not public.is_active_agent() then
    raise exception 'Only active agents can delete cases' using errcode = '42501';
  end if;

  update public.cases
  set permanently_deleted_at = now()
  where id = target_case_id and permanently_deleted_at is null;

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function public.delete_case(bigint) from public, anon;
grant execute on function public.delete_case(bigint) to authenticated;

create or replace view public.kpi_cases with (security_invoker = true) as
select
  category,
  channel,
  count(*) filter (where status = 'resolved') as resolved_count,
  count(*) filter (where status <> 'resolved') as open_count,
  avg(resolved_at - created_at) filter (where status = 'resolved') as avg_resolution_time
from public.cases
where deleted_at is null and permanently_deleted_at is null
group by category, channel;

create or replace function public.kpi_report(period_days int default 30)
returns table (
  dimension text,
  key text,
  open_count bigint,
  resolved_count bigint,
  avg_resolution_seconds double precision
)
language sql stable security invoker as $$
  with base as (
    select
      channel,
      category,
      status,
      extract(epoch from (resolved_at - created_at))::double precision as secs,
      (status = 'resolved'
        and resolved_at >= now() - make_interval(days => period_days)) as resolved_in_period
    from public.cases
    where deleted_at is null and permanently_deleted_at is null
  )
  select 'all'::text, 'all'::text,
         count(*) filter (where status <> 'resolved'),
         count(*) filter (where resolved_in_period),
         avg(secs) filter (where resolved_in_period)
  from base
  union all
  select 'channel'::text, channel::text,
         count(*) filter (where status <> 'resolved'),
         count(*) filter (where resolved_in_period),
         avg(secs) filter (where resolved_in_period)
  from base group by channel
  union all
  select 'category'::text, category::text,
         count(*) filter (where status <> 'resolved'),
         count(*) filter (where resolved_in_period),
         avg(secs) filter (where resolved_in_period)
  from base group by category;
$$;

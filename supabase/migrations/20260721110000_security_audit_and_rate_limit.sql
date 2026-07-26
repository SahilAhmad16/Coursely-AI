-- Operational audit trail and database-backed throttling for the public AI helper.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 1 and 120),
  resource_type text not null check (char_length(resource_type) between 1 and 80),
  resource_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.assistant_rate_limits (
  rate_key text primary key check (char_length(rate_key) between 8 and 160),
  window_started timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
alter table public.audit_logs enable row level security;
alter table public.assistant_rate_limits enable row level security;
grant select, insert on public.audit_logs to authenticated;

create policy "admins view audit logs" on public.audit_logs for select to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "actors create their audit logs" on public.audit_logs for insert to authenticated
with check (actor_id = (select auth.uid()));

create or replace function public.consume_assistant_rate_limit(rate_key_input text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare request_total integer;
begin
  if rate_key_input is null or char_length(rate_key_input) < 8 or char_length(rate_key_input) > 160 then
    return false;
  end if;
  insert into public.assistant_rate_limits (rate_key, window_started, request_count, updated_at)
  values (rate_key_input, now(), 1, now())
  on conflict (rate_key) do update set
    request_count = case when public.assistant_rate_limits.window_started < now() - interval '15 minutes' then 1 else public.assistant_rate_limits.request_count + 1 end,
    window_started = case when public.assistant_rate_limits.window_started < now() - interval '15 minutes' then now() else public.assistant_rate_limits.window_started end,
    updated_at = now()
  returning request_count into request_total;
  return request_total <= 12;
end;
$$;
revoke all on function public.consume_assistant_rate_limit(text) from public;
grant execute on function public.consume_assistant_rate_limit(text) to anon, authenticated;

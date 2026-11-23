-- Run once in the Supabase SQL Editor. No public read/write policies are created.
create table public.kw_feedback (
  id uuid primary key,
  created_at timestamptz not null default now(),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  payload_hash text not null,
  is_test boolean not null default false,
  notes text not null default '' check (length(notes) <= 5000)
);
create table public.kw_feedback_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null
);
alter table public.kw_feedback enable row level security;
alter table public.kw_feedback_limits enable row level security;
revoke all on public.kw_feedback, public.kw_feedback_limits from anon, authenticated;
grant all on public.kw_feedback, public.kw_feedback_limits to service_role;

create function public.kw_feedback_rate(p_key text, p_limit integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare attempts integer;
begin
  -- Keep only recent salted buckets; no raw IP addresses are stored.
  delete from public.kw_feedback_limits where window_start < now() - interval '2 hours';
  insert into public.kw_feedback_limits(key,window_start,count) values(p_key,now(),1)
  on conflict(key) do update set
    count = case when kw_feedback_limits.window_start < now()-interval '1 hour' then 1 else kw_feedback_limits.count+1 end,
    window_start = case when kw_feedback_limits.window_start < now()-interval '1 hour' then now() else kw_feedback_limits.window_start end
  returning count into attempts;
  return attempts <= p_limit;
end $$;

create function public.kw_submit_feedback(p_id uuid,p_data jsonb,p_hash text,p_ip text,p_test boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare existing text;
begin
  -- Serialize concurrent retries of the same ID, across all Vercel instances.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select payload_hash into existing from public.kw_feedback where id=p_id;
  if found then
    if existing=p_hash then return 'duplicate'; else return 'conflict'; end if;
  end if;
  if not public.kw_feedback_rate('submit:'||p_ip,60) then return 'limited'; end if;
  insert into public.kw_feedback(id,data,payload_hash,is_test) values(p_id,p_data,p_hash,p_test);
  return 'created';
end $$;
revoke all on function public.kw_feedback_rate(text,integer) from public, anon, authenticated;
revoke all on function public.kw_submit_feedback(uuid,jsonb,text,text,boolean) from public, anon, authenticated;
grant execute on function public.kw_feedback_rate(text,integer) to service_role;
grant execute on function public.kw_submit_feedback(uuid,jsonb,text,text,boolean) to service_role;

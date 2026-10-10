begin;
create table public.reservations (
  request_id uuid primary key,
  created_at timestamptz not null default now(),
  fname text not null check(length(fname) between 1 and 100),
  lname text not null check(length(lname) between 1 and 100),
  email text not null check(length(email) between 3 and 254),
  country text not null check(length(country) between 1 and 100),
  referralname text not null default '' check(length(referralname)<=200),
  message text not null check(length(message) between 1 and 4000),
  reservestartdate date not null,
  reserveenddate date not null,
  status text not null default 'pending' check(status in ('pending','confirmed','cancelled','blocked')),
  check(reserveenddate>reservestartdate),
  constraint no_overlapping_confirmed_stays exclude using gist
    (daterange(reservestartdate,reserveenddate,'[)') with &&)
    where (status in ('confirmed','blocked'))
);
comment on table public.reservations is 'Single whole-property bookings. Pending requests do not hold dates. Confirmed and blocked rows prevent overlaps.';
create table public.request_limits (
  key text primary key, window_start timestamptz not null, attempts integer not null
);
alter table public.reservations enable row level security;
alter table public.request_limits enable row level security;
revoke all on public.reservations,public.request_limits from anon,authenticated;
grant all on public.reservations,public.request_limits to service_role;

create function public.take_request_slot(p_key text,p_limit integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
  delete from public.request_limits where window_start < now()-interval '1 day';
  insert into public.request_limits as limits(key,window_start,attempts) values(p_key,now(),1)
  on conflict(key) do update set
    attempts=case when limits.window_start < now()-interval '15 minutes' then 1 else limits.attempts+1 end,
    window_start=case when limits.window_start < now()-interval '15 minutes' then now() else limits.window_start end
  returning attempts into n;
  return n<=p_limit;
end $$;

create function public.stay_available(p_start date,p_end date)
returns boolean language sql stable security invoker set search_path='' as $$
 select p_end>p_start and not exists (
  select 1 from public.reservations where status in ('confirmed','blocked')
  and daterange(reservestartdate,reserveenddate,'[)') && daterange(p_start,p_end,'[)')
 );
$$;

create function public.submit_reservation(p_entry jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 -- Serialize request checks against administrative confirmation writes.
 lock table public.reservations in share row exclusive mode;
 if exists(select 1 from public.reservations where request_id=(p_entry->>'request_id')::uuid) then
   return '{"accepted":true}'::jsonb;
 end if;
 if not public.stay_available((p_entry->>'reservestartdate')::date,(p_entry->>'reserveenddate')::date) then
   return '{"accepted":false}'::jsonb;
 end if;
 insert into public.reservations(request_id,fname,lname,email,country,referralname,message,reservestartdate,reserveenddate)
 values((p_entry->>'request_id')::uuid,p_entry->>'fname',p_entry->>'lname',p_entry->>'email',p_entry->>'country',p_entry->>'referralname',p_entry->>'message',(p_entry->>'reservestartdate')::date,(p_entry->>'reserveenddate')::date);
 return '{"accepted":true}'::jsonb;
end $$;

revoke all on function public.take_request_slot(text,integer),public.stay_available(date,date),public.submit_reservation(jsonb) from public,anon,authenticated;
grant execute on function public.take_request_slot(text,integer),public.stay_available(date,date),public.submit_reservation(jsonb) to service_role;
commit;

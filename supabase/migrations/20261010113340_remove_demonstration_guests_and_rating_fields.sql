-- Production removal verified exactly 150 matching records before execution.
-- Accept an empty batch when replaying migrations on a fresh installation.
do $$
declare n integer;
begin
 lock table public.reservations in access exclusive mode;
 select count(*) into n from public.reservations where referralname='DEMO-SEED-150-20261010' and is_demo and email like 'demo.client.%@example.test';
 if n not in (0,150) then raise exception 'Expected zero or 150 demonstration reservations, found %',n; end if;
 if exists(select 1 from public.reservations where not (referralname='DEMO-SEED-150-20261010' and is_demo and email like 'demo.client.%@example.test') and (customer_rating is not null or is_demo or status='completed')) then raise exception 'Non-target data depends on demonstration schema'; end if;
 delete from public.reservations where referralname='DEMO-SEED-150-20261010' and is_demo and email like 'demo.client.%@example.test';
 alter table public.reservations drop column customer_rating, drop column is_demo;
 alter table public.reservations drop constraint reservations_status_check;
 alter table public.reservations add constraint reservations_status_check check(status in ('pending','confirmed','cancelled','blocked'));
end $$;
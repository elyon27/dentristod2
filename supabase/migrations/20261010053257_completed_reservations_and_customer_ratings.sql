begin;
alter table public.reservations drop constraint reservations_status_check;
alter table public.reservations add constraint reservations_status_check
  check (status in ('pending','confirmed','cancelled','blocked','completed'));
alter table public.reservations add column customer_rating smallint
  check (customer_rating between 1 and 5);
alter table public.reservations add column is_demo boolean not null default false;
comment on column public.reservations.customer_rating is 'Customer rating from 1 to 5 stars. NULL means unrated. Ratings on is_demo rows are synthetic demonstration values, not real reviews.';
comment on column public.reservations.is_demo is 'True for synthetic demonstration records; exclude from genuine customer review statistics.';
commit;
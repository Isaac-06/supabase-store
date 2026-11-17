alter table public.orders
	add column if not exists payment_confirmed_at timestamptz;

create or replace function public.set_order_payment_confirmed_at()
returns trigger
language plpgsql
as $$
begin
	if new.status = 'paid'
		and old.status is distinct from 'paid'
		and new.payment_confirmed_at is null then
		new.payment_confirmed_at := now();
	end if;

	return new;
end;
$$;

drop trigger if exists set_order_payment_confirmed_at on public.orders;
create trigger set_order_payment_confirmed_at
	before update of status on public.orders
	for each row
	execute function public.set_order_payment_confirmed_at();

alter table public.orders enable row level security;

create policy "Customers can read their own orders"
	on public.orders
	as permissive
	for select
	to authenticated
	using (auth.uid() = user_id);

create policy "Restrict customer order reads to owner"
	on public.orders
	as restrictive
	for select
	to authenticated
	using (auth.uid() = user_id);

alter table public.orders
	add column if not exists payment_reference text,
	add column if not exists payment_currency text,
	add column if not exists payment_amount_kobo bigint;

create unique index if not exists orders_payment_reference_key
	on public.orders (payment_reference)
	where payment_reference is not null;

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'orders_payment_amount_kobo_positive'
			and conrelid = 'public.orders'::regclass
	) then
		alter table public.orders
			add constraint orders_payment_amount_kobo_positive
			check (payment_amount_kobo is null or payment_amount_kobo > 0);
	end if;
end
$$;

drop policy if exists "Customers can create their own orders" on public.orders;

do $$
declare
	routine record;
begin
	for routine in
		select p.oid::regprocedure as signature
		from pg_proc p
		join pg_namespace n on n.oid = p.pronamespace
		where n.nspname = 'public'
			and p.proname = 'create_order'
	loop
		execute format(
			'revoke execute on function %s from public, anon, authenticated',
			routine.signature
		);
	end loop;
end
$$;

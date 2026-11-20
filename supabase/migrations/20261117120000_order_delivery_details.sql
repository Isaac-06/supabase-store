create table if not exists public.order_delivery_details (
	order_id bigint primary key references public.orders(id) on delete cascade,
	user_id uuid not null references auth.users(id) on delete cascade,
	phone text not null,
	address_line_1 text not null,
	address_line_2 text not null default '',
	city text not null,
	postal_code text not null,
	created_at timestamptz not null default now()
);

insert into public.order_delivery_details (
	order_id,
	user_id,
	phone,
	address_line_1,
	address_line_2,
	city,
	postal_code
)
select
	orders.id,
	orders.user_id,
	coalesce(orders.phone, orders.shipping_address->>'phone', ''),
	coalesce(orders.shipping_address->>'address_line_1', ''),
	coalesce(orders.shipping_address->>'address_line_2', ''),
	coalesce(orders.shipping_address->>'city', ''),
	coalesce(orders.shipping_address->>'postal_code', '')
from public.orders as orders
join auth.users as users on users.id = orders.user_id
where orders.shipping_address is not null
	and jsonb_typeof(orders.shipping_address) = 'object'
on conflict (order_id) do nothing;

create index if not exists order_delivery_details_user_id_idx
	on public.order_delivery_details (user_id);

alter table public.order_delivery_details enable row level security;

drop policy if exists "Customers can read their own order delivery details"
	on public.order_delivery_details;
create policy "Customers can read their own order delivery details"
	on public.order_delivery_details
	for select
	to authenticated
	using (auth.uid() = user_id);

drop policy if exists "Restrict customer delivery-detail reads to owner"
	on public.order_delivery_details;
create policy "Restrict customer delivery-detail reads to owner"
	on public.order_delivery_details
	as restrictive
	for select
	to authenticated
	using (auth.uid() = user_id);

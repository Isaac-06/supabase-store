alter table public.cart_items
  add column if not exists image text,
  add column if not exists price numeric(12, 2) not null default 0,
  add column if not exists product_name text not null default 'Product',
  add column if not exists quantity integer not null default 1,
  add column if not exists customization_notes text not null default '',
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists cart_items_user_id_product_id_key
  on public.cart_items (user_id, product_id);

alter table public.cart_items enable row level security;

drop policy if exists "Users can read their own cart items" on public.cart_items;
create policy "Users can read their own cart items"
  on public.cart_items
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own cart items" on public.cart_items;
create policy "Users can insert their own cart items"
  on public.cart_items
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own cart items" on public.cart_items;
create policy "Users can update their own cart items"
  on public.cart_items
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own cart items" on public.cart_items;
create policy "Users can delete their own cart items"
  on public.cart_items
  for delete
  to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';

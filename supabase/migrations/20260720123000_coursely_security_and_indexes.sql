-- Lock down the project-level RLS helper created by the Supabase console.
-- The application does not call this function through the public API.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

-- Avoid duplicate permissive SELECT policies on product_media.
drop policy if exists "owners manage product media" on public.product_media;
create policy "owners add product media" on public.product_media for insert to authenticated
  with check (exists (select 1 from public.products p join public.stores s on s.id = p.store_id where p.id = product_id and s.owner_id = (select auth.uid())));
create policy "owners update product media" on public.product_media for update to authenticated
  using (exists (select 1 from public.products p join public.stores s on s.id = p.store_id where p.id = product_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.products p join public.stores s on s.id = p.store_id where p.id = product_id and s.owner_id = (select auth.uid())));
create policy "owners delete product media" on public.product_media for delete to authenticated
  using (exists (select 1 from public.products p join public.stores s on s.id = p.store_id where p.id = product_id and s.owner_id = (select auth.uid())));

-- Index foreign keys and common marketplace lookups before data volume grows.
create index if not exists categories_parent_id_idx on public.categories(parent_id);
create index if not exists products_store_id_idx on public.products(store_id);
create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_published_created_at_idx on public.products(status, created_at desc) where status = 'published';
create index if not exists product_media_product_position_idx on public.product_media(product_id, position);
create index if not exists orders_buyer_id_idx on public.orders(buyer_id);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists order_items_seller_id_idx on public.order_items(seller_id);
create index if not exists shipments_order_id_idx on public.shipments(order_id);
create index if not exists reviews_buyer_id_idx on public.reviews(buyer_id);

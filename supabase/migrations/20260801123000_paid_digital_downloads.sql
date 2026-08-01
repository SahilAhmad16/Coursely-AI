-- Preserve the purchased listing type for paid-order fulfilment.
alter table public.order_items add column listing_type_snapshot public.listing_type;

update public.order_items oi
set listing_type_snapshot = p.listing_type
from public.products p
where p.id = oi.product_id;

alter table public.order_items alter column listing_type_snapshot set not null;

create or replace function public.create_checkout_order(p_items jsonb)
returns table(order_id uuid, order_number bigint, total_paise integer, currency text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  expected_count integer;
  valid_count integer;
  calculated_total integer;
  created_order_id uuid;
  created_order_number bigint;
begin
  if current_user_id is null then raise exception 'Authentication required.'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'A valid cart is required.'; end if;

  select count(*)::integer into expected_count from jsonb_array_elements(p_items);
  if expected_count < 1 or expected_count > 25 then raise exception 'The cart must contain between 1 and 25 items.'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where not ((item ->> 'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
       or not (coalesce(item ->> 'quantity', '') ~ '^1$')
  ) then raise exception 'The cart contains an invalid item.'; end if;

  if (select count(distinct item ->> 'product_id') from jsonb_array_elements(p_items) item) <> expected_count then
    raise exception 'Duplicate cart items are not allowed.';
  end if;

  select count(*)::integer, sum(p.price_paise)::integer into valid_count, calculated_total
  from jsonb_array_elements(p_items) item
  join public.products p on p.id = (item ->> 'product_id')::uuid
  join public.stores s on s.id = p.store_id
  where p.status = 'published' and p.listing_type in ('digital', 'service')
    and p.currency = 'INR' and p.price_paise > 0 and s.owner_id <> current_user_id
    and private.listing_subscription_is_active(p.store_id, p.listing_type)
    and (p.listing_type <> 'digital' or p.digital_file_path is not null);

  if valid_count <> expected_count or calculated_total is null then
    raise exception 'One or more items are unavailable for checkout.';
  end if;

  insert into public.orders (buyer_id, subtotal_paise, total_paise, currency, payment_provider)
  values (current_user_id, calculated_total, calculated_total, 'INR', 'cashfree')
  returning id, public.orders.order_number into created_order_id, created_order_number;

  insert into public.order_items (order_id, product_id, seller_id, title_snapshot, listing_type_snapshot, quantity, unit_price_paise)
  select created_order_id, p.id, s.owner_id, p.title, p.listing_type, 1, p.price_paise
  from jsonb_array_elements(p_items) item
  join public.products p on p.id = (item ->> 'product_id')::uuid
  join public.stores s on s.id = p.store_id;

  return query select created_order_id, created_order_number, calculated_total, 'INR'::text;
end;
$$;

revoke all on function public.create_checkout_order(jsonb) from public;
grant execute on function public.create_checkout_order(jsonb) to authenticated;

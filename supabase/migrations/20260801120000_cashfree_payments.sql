-- Cashfree payment records and atomic fulfilment for marketplace orders and seller-plan renewals.
create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'cashfree' check (provider = 'cashfree'),
  provider_order_id text not null unique,
  provider_cf_order_id text,
  provider_payment_id text,
  purpose text not null check (purpose in ('marketplace_order', 'seller_subscription')),
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  subscription_id uuid references public.platform_subscriptions(id) on delete restrict,
  amount_paise integer not null check (amount_paise > 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_attempt_target_matches_purpose check (
    (purpose = 'marketplace_order' and order_id is not null and subscription_id is null)
    or (purpose = 'seller_subscription' and subscription_id is not null and order_id is null)
  )
);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'cashfree' check (provider = 'cashfree'),
  idempotency_key text not null unique,
  provider_order_id text,
  event_type text not null,
  payload jsonb not null,
  processed boolean not null default false,
  processing_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index payment_attempts_buyer_created_idx on public.payment_attempts(buyer_id, created_at desc);
create index payment_attempts_order_idx on public.payment_attempts(order_id) where order_id is not null;
create index payment_attempts_subscription_idx on public.payment_attempts(subscription_id) where subscription_id is not null;
create index payment_webhook_events_order_idx on public.payment_webhook_events(provider_order_id, created_at desc);

create trigger payment_attempts_updated_at
before update on public.payment_attempts
for each row execute procedure public.touch_updated_at();

alter table public.payment_attempts enable row level security;
alter table public.payment_webhook_events enable row level security;

grant select on public.payment_attempts to authenticated;
grant select on public.payment_webhook_events to authenticated;

create policy "buyers view own payment attempts"
on public.payment_attempts for select to authenticated
using (buyer_id = (select auth.uid()) or private.current_user_is_admin());

create policy "admins view payment webhook events"
on public.payment_webhook_events for select to authenticated
using (private.current_user_is_admin());

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
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'A valid cart is required.';
  end if;

  select count(*)::integer into expected_count from jsonb_array_elements(p_items);
  if expected_count < 1 or expected_count > 25 then
    raise exception 'The cart must contain between 1 and 25 items.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where not ((item ->> 'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
       or not (coalesce(item ->> 'quantity', '') ~ '^1$')
  ) then
    raise exception 'The cart contains an invalid item.';
  end if;

  if (select count(distinct item ->> 'product_id') from jsonb_array_elements(p_items) item) <> expected_count then
    raise exception 'Duplicate cart items are not allowed.';
  end if;

  select count(*)::integer, sum(p.price_paise)::integer
  into valid_count, calculated_total
  from jsonb_array_elements(p_items) item
  join public.products p on p.id = (item ->> 'product_id')::uuid
  join public.stores s on s.id = p.store_id
  where p.status = 'published'
    and p.listing_type in ('digital', 'service')
    and p.currency = 'INR'
    and p.price_paise > 0
    and s.owner_id <> current_user_id
    and private.listing_subscription_is_active(p.store_id, p.listing_type)
    and (p.listing_type <> 'digital' or p.digital_file_path is not null);

  if valid_count <> expected_count or calculated_total is null then
    raise exception 'One or more items are unavailable for checkout.';
  end if;

  insert into public.orders (buyer_id, subtotal_paise, total_paise, currency, payment_provider)
  values (current_user_id, calculated_total, calculated_total, 'INR', 'cashfree')
  returning id, public.orders.order_number into created_order_id, created_order_number;

  insert into public.order_items (order_id, product_id, seller_id, title_snapshot, quantity, unit_price_paise)
  select created_order_id, p.id, s.owner_id, p.title, 1, p.price_paise
  from jsonb_array_elements(p_items) item
  join public.products p on p.id = (item ->> 'product_id')::uuid
  join public.stores s on s.id = p.store_id;

  return query select created_order_id, created_order_number, calculated_total, 'INR'::text;
end;
$$;

revoke all on function public.create_checkout_order(jsonb) from public;
grant execute on function public.create_checkout_order(jsonb) to authenticated;

create or replace function public.settle_cashfree_payment(
  p_provider_order_id text,
  p_provider_payment_id text,
  p_amount_paise integer,
  p_currency text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.payment_attempts%rowtype;
  period_base timestamptz;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  select * into attempt
  from public.payment_attempts
  where provider_order_id = p_provider_order_id
  for update;

  if not found then raise exception 'Unknown Cashfree order.'; end if;
  if attempt.amount_paise <> p_amount_paise or trim(attempt.currency) <> upper(p_currency) then
    raise exception 'Cashfree amount or currency mismatch.';
  end if;
  if attempt.status = 'paid' then return attempt.purpose; end if;

  update public.payment_attempts
  set status = 'paid', provider_payment_id = p_provider_payment_id,
      paid_at = now(), failure_reason = null
  where id = attempt.id;

  if attempt.purpose = 'marketplace_order' then
    update public.orders
    set status = 'paid', payment_provider = 'cashfree', payment_reference = p_provider_payment_id
    where id = attempt.order_id and status = 'pending_payment';

    insert into public.notifications (user_id, kind, title, body, href)
    values (attempt.buyer_id, 'account', 'Payment confirmed', 'Your Coursely AI order payment was confirmed securely.', '/account');
  else
    select greatest(now(), coalesce(current_period_end, now())) into period_base
    from public.platform_subscriptions where id = attempt.subscription_id for update;

    update public.platform_subscriptions
    set status = 'active', provider = 'cashfree', provider_subscription_id = p_provider_order_id,
        is_trial = false, current_period_start = period_base,
        current_period_end = period_base + interval '28 days'
    where id = attempt.subscription_id;

    insert into public.notifications (user_id, kind, title, body, href)
    values (attempt.buyer_id, 'account', 'Seller plan renewed', 'Your seller category is active for another 28 days.', '/seller-plan');
  end if;

  return attempt.purpose;
end;
$$;

revoke all on function public.settle_cashfree_payment(text, text, integer, text) from public;
grant execute on function public.settle_cashfree_payment(text, text, integer, text) to service_role;

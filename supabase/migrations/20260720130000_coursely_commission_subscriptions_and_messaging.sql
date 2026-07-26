create type public.subscription_status as enum ('pending', 'active', 'past_due', 'cancelled');
create type public.ledger_status as enum ('pending', 'earned', 'settled', 'refunded');

create table public.platform_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  amount_paise integer not null default 15000 check (amount_paise = 15000),
  currency char(3) not null default 'INR',
  status public.subscription_status not null default 'pending',
  provider text,
  provider_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_ledger (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  seller_id uuid not null references public.profiles(id),
  gross_paise integer not null check (gross_paise >= 0),
  commission_rate_bps integer not null default 1000 check (commission_rate_bps = 1000),
  commission_paise integer not null check (commission_paise >= 0),
  seller_net_paise integer not null check (seller_net_paise >= 0),
  status public.ledger_status not null default 'earned',
  created_at timestamptz not null default now(),
  unique(order_id, seller_id),
  constraint ledger_split_matches_gross check (commission_paise + seller_net_paise = gross_paise)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, customer_id),
  constraint conversation_participants_differ check (customer_id <> seller_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index platform_ledger_seller_created_idx on public.platform_ledger(seller_id, created_at desc);
create index conversations_customer_updated_idx on public.conversations(customer_id, updated_at desc);
create index conversations_seller_updated_idx on public.conversations(seller_id, updated_at desc);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);

create function public.touch_conversation_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger conversations_updated_at before update on public.conversations for each row execute procedure public.touch_conversation_updated_at();
create trigger platform_subscriptions_updated_at before update on public.platform_subscriptions for each row execute procedure public.touch_updated_at();

create function public.ensure_service_subscription()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.listing_type = 'service' then
    insert into public.platform_subscriptions (store_id)
    values (new.store_id)
    on conflict (store_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.ensure_service_subscription() from public;
create trigger products_create_service_subscription after insert on public.products for each row execute procedure public.ensure_service_subscription();

create function public.validate_conversation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.products p
    join public.stores s on s.id = p.store_id
    where p.id = new.product_id
      and p.listing_type = 'service'
      and p.status = 'published'
      and s.owner_id = new.seller_id
  ) then
    raise exception 'Conversations can only be opened with the seller of a published service listing.';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_conversation() from public;
create trigger conversations_validate before insert or update on public.conversations for each row execute procedure public.validate_conversation();

create function public.create_platform_ledger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status is distinct from 'paid' and new.status = 'paid' then
    insert into public.platform_ledger (order_id, seller_id, gross_paise, commission_paise, seller_net_paise, status)
    select
      new.id,
      oi.seller_id,
      sum(oi.unit_price_paise * oi.quantity)::integer,
      ceil(sum(oi.unit_price_paise * oi.quantity) * 0.10)::integer,
      sum(oi.unit_price_paise * oi.quantity)::integer - ceil(sum(oi.unit_price_paise * oi.quantity) * 0.10)::integer,
      'earned'
    from public.order_items oi
    where oi.order_id = new.id
    group by oi.seller_id
    on conflict (order_id, seller_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.create_platform_ledger() from public;
create trigger orders_create_platform_ledger after update of status on public.orders for each row execute procedure public.create_platform_ledger();

create or replace function public.enforce_product_status_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.listing_type = 'service' and new.status in ('pending_review', 'published') and not exists (
    select 1 from public.platform_subscriptions ps
    where ps.store_id = new.store_id
      and ps.status = 'active'
      and ps.current_period_end > now()
  ) then
    raise exception 'An active ₹150 monthly service-seller subscription is required before a service can be reviewed or published.';
  end if;

  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    return new;
  end if;
  if old.status not in ('draft', 'pending_review', 'rejected') or new.status not in ('draft', 'pending_review') then
    raise exception 'Only Coursely AI administrators can publish, reject, archive, or modify a published listing.';
  end if;
  return new;
end;
$$;

alter table public.platform_subscriptions enable row level security;
alter table public.platform_ledger enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
grant select on public.platform_subscriptions, public.platform_ledger, public.conversations, public.messages to authenticated;
grant insert on public.conversations, public.messages to authenticated;

create policy "sellers view own subscriptions" on public.platform_subscriptions for select to authenticated using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid())));
create policy "admins view subscriptions" on public.platform_subscriptions for select to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "sellers view own ledger" on public.platform_ledger for select to authenticated using (seller_id = (select auth.uid()));
create policy "admins view ledger" on public.platform_ledger for select to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "conversation participants view conversations" on public.conversations for select to authenticated using (customer_id = (select auth.uid()) or seller_id = (select auth.uid()));
create policy "customers open conversations" on public.conversations for insert to authenticated with check (customer_id = (select auth.uid()));
create policy "participants view messages" on public.messages for select to authenticated using (exists (select 1 from public.conversations c where c.id = conversation_id and ((select auth.uid()) = c.customer_id or (select auth.uid()) = c.seller_id)));
create policy "participants send messages" on public.messages for insert to authenticated with check (sender_id = (select auth.uid()) and exists (select 1 from public.conversations c where c.id = conversation_id and ((select auth.uid()) = c.customer_id or (select auth.uid()) = c.seller_id)));

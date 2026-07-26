-- Align the database with Coursely AI's three seller paths:
-- digital products, professional services, and affiliate products.
-- The legacy `physical` seller-plan enum value is retained internally because
-- existing migrations use it for the Product Affiliate plan.

update public.categories
set name = 'Affiliate products', slug = 'affiliate-products'
where slug = 'physical-products';

alter table public.products
  drop constraint if exists products_no_direct_physical_listings;
alter table public.products
  add constraint products_no_direct_physical_listings
  check (listing_type <> 'physical');

comment on constraint products_no_direct_physical_listings on public.products is
  'Coursely AI does not sell or ship physical inventory; product listings are affiliate-only.';

comment on column public.platform_subscriptions.plan_type is
  'Internal plan code. The legacy physical value represents the Product Affiliate seller plan.';

-- Correct an ambiguous reference in the original storage policy. Without the
-- qualified object name PostgreSQL can bind `name` to public.stores.name.
drop policy if exists "published store assets are readable" on storage.objects;
create policy "published store assets are readable"
on storage.objects for select
using (
  bucket_id = 'store-assets'
  and exists (
    select 1
    from public.stores s
    where (
      s.logo_path = storage.objects.name
      or s.banner_path = storage.objects.name
    )
    and exists (
      select 1
      from public.products p
      where p.store_id = s.id
        and p.status = 'published'
        and p.listing_type in ('digital', 'service', 'affiliate')
    )
  )
);

-- Only digital products are commissionable on Coursely AI. Services have no
-- per-sale commission, and affiliate purchases happen on the partner platform.
create or replace function public.create_platform_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from 'paid' and new.status = 'paid' then
    insert into public.platform_ledger (
      order_id,
      seller_id,
      gross_paise,
      commission_rate_bps,
      commission_paise,
      seller_net_paise,
      status
    )
    select
      new.id,
      oi.seller_id,
      sum(oi.unit_price_paise * oi.quantity)::integer,
      case
        when sum(
          case when p.listing_type = 'digital'
            then oi.unit_price_paise * oi.quantity else 0 end
        ) > 0 then 1000
        else 0
      end,
      ceil(sum(
        case when p.listing_type = 'digital'
          then oi.unit_price_paise * oi.quantity else 0 end
      ) * 0.10)::integer,
      sum(oi.unit_price_paise * oi.quantity)::integer
        - ceil(sum(
          case when p.listing_type = 'digital'
            then oi.unit_price_paise * oi.quantity else 0 end
        ) * 0.10)::integer,
      'earned'
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = new.id
    group by oi.seller_id
    on conflict (order_id, seller_id) do nothing;
  end if;
  return new;
end;
$$;

with repriced as (
  select
    pl.id,
    coalesce(sum(
      case when p.listing_type = 'digital'
        then oi.unit_price_paise * oi.quantity else 0 end
    ), 0)::integer as commissionable_gross
  from public.platform_ledger pl
  join public.order_items oi
    on oi.order_id = pl.order_id
    and oi.seller_id = pl.seller_id
  join public.products p on p.id = oi.product_id
  group by pl.id
)
update public.platform_ledger pl
set
  commission_rate_bps = case when repriced.commissionable_gross > 0 then 1000 else 0 end,
  commission_paise = ceil(repriced.commissionable_gross * 0.10)::integer,
  seller_net_paise = pl.gross_paise - ceil(repriced.commissionable_gross * 0.10)::integer
from repriced
where pl.id = repriced.id;

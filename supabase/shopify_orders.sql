-- ============================================================
-- Shopify order alerts — run this once in the Supabase SQL Editor (Run).
-- Safe to re-run: it never duplicates or deletes rows.
-- ============================================================

create table if not exists shopify_orders (
  id                 bigint generated always as identity primary key,
  shop_domain        text        not null,                 -- iboozesg.myshopify.com
  brand              text        not null,                 -- "iBoozee Singapore"
  order_name         text        not null,                 -- "#1059"
  order_id           bigint,                               -- Shopify numeric id (for dedupe)
  customer           text,                                 -- licensee name
  items              integer     not null default 0,       -- total item count
  item_summary       text,                                 -- "2× Apple Cup, 1× Lids"
  total              numeric     not null default 0,
  currency           text,                                 -- SGD / MYR
  financial_status   text,                                 -- paid | pending | ...
  fulfillment_status text,                                 -- fulfilled | unfulfilled
  delivery           text,                                 -- "Self pickup" / shipping method
  ordered_at         timestamptz,                          -- Shopify order time
  created_at         timestamptz not null default now()    -- when we received it
);

-- Webhooks get retried by Shopify on any non-2xx/timeout. This unique index +
-- the route's "upsert ignore duplicates" means a retry never double-inserts.
create unique index if not exists shopify_orders_uniq on shopify_orders(shop_domain, order_id);

-- Server-side only: the Next.js app reads/writes with the SERVICE_ROLE key, which
-- bypasses RLS. No public/anon access.
alter table shopify_orders enable row level security;

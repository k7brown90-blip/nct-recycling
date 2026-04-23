create table if not exists public.shopify_app_installations (
  id uuid primary key default gen_random_uuid(),
  shop_domain text not null unique,
  access_token text not null,
  scope text,
  token_type text not null default 'offline',
  store_name text,
  storefront_url text,
  install_source text not null default 'oauth',
  connected_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_error text
);

create index if not exists shopify_app_installations_updated_at_idx
  on public.shopify_app_installations (updated_at desc);
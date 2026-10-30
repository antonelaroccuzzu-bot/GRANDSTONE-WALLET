-- Registry linking Privy deposit wallets to authenticated Grandstone customers.
create table if not exists public.wallet_deposit_addresses (
  wallet_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset text not null,
  network text not null,
  address text not null,
  chain_type text not null,
  created_at timestamptz not null default now(),
  unique (network, address, asset)
);
create index if not exists wallet_deposit_addresses_user_idx
  on public.wallet_deposit_addresses(user_id);
alter table public.wallet_deposit_addresses enable row level security;
revoke all on public.wallet_deposit_addresses from anon, authenticated;
grant all on public.wallet_deposit_addresses to service_role;

-- Authenticated provider events are durably recorded before any credit decision.
create table if not exists public.wallet_deposit_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  wallet_id text not null references public.wallet_deposit_addresses(wallet_id),
  transaction_hash text not null,
  asset text not null,
  network text not null,
  raw_event jsonb not null,
  status text not null default 'received'
    check (status in ('received','confirming','credited','ignored','rejected')),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists wallet_deposit_events_status_idx
  on public.wallet_deposit_events(status, received_at);
alter table public.wallet_deposit_events enable row level security;
revoke all on public.wallet_deposit_events from anon, authenticated;
grant all on public.wallet_deposit_events to service_role;

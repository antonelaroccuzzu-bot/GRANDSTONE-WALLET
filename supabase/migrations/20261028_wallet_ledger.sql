-- Grandstone Wallet ledger tables.
-- Run in Supabase SQL Editor before using balances or accepting deposits.

create extension if not exists pgcrypto;

create table if not exists public.wallet_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset text not null,
  network text not null,
  available_balance numeric(38,18) not null default 0 check (available_balance >= 0),
  locked_balance numeric(38,18) not null default 0 check (locked_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, asset, network)
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.wallet_accounts(id),
  kind text not null check (kind in ('deposit','withdrawal','transfer','trade','fee','adjustment')),
  status text not null default 'pending' check (status in ('pending','confirming','completed','failed','reversed')),
  asset text not null,
  network text not null,
  amount numeric(38,18) not null check (amount > 0),
  network_tx_id text,
  idempotency_key text not null,
  source text not null,
  confirmations integer not null default 0 check (confirmations >= 0),
  destination text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (network, network_tx_id)
);

create table if not exists public.wallet_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.wallet_transactions(id),
  account_id uuid not null references public.wallet_accounts(id),
  entry_type text not null check (entry_type in ('credit','debit','hold','release','reversal')),
  amount numeric(38,18) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists wallet_accounts_user_idx on public.wallet_accounts(user_id);
create index if not exists wallet_transactions_user_created_idx on public.wallet_transactions(user_id, created_at desc);
create index if not exists wallet_ledger_account_created_idx on public.wallet_ledger_entries(account_id, created_at desc);

alter table public.wallet_accounts enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.wallet_ledger_entries enable row level security;

drop policy if exists "Users can read their wallet accounts" on public.wallet_accounts;
create policy "Users can read their wallet accounts" on public.wallet_accounts for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read their wallet transactions" on public.wallet_transactions;
create policy "Users can read their wallet transactions" on public.wallet_transactions for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read their own ledger entries" on public.wallet_ledger_entries;
create policy "Users can read their own ledger entries" on public.wallet_ledger_entries for select to authenticated using (
  exists (select 1 from public.wallet_accounts a where a.id = account_id and a.user_id = auth.uid())
);

revoke insert, update, delete on public.wallet_accounts from anon, authenticated;
revoke insert, update, delete on public.wallet_transactions from anon, authenticated;
revoke insert, update, delete on public.wallet_ledger_entries from anon, authenticated;
grant select on public.wallet_accounts, public.wallet_transactions, public.wallet_ledger_entries to authenticated;

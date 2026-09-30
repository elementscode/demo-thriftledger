-- add ledger

-- Auto-update updatedAt on row changes.
create or replace function touchUpdatedAt()
returns trigger
language plpgsql
as $$
begin
  new.updatedAt = now();
  return new;
end;
$$;

create table users (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  email text not null unique,
  name text not null,
  passwordHash text not null
);

create trigger usersTouchUpdatedAt
  before update on users
  for each row execute function touchUpdatedAt();

create table accounts (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  userId uuid not null references users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('checking', 'savings', 'credit')),
  institution text not null default '',
  -- The balance before the first transaction in the ledger. A credit card
  -- starts negative: it is money owed.
  openingBalanceCents integer not null default 0,
  -- The column mapping for this bank's CSV export, set on the first import:
  -- { dateColumn, descriptionColumn, amountColumn, invertAmounts }.
  csvMapping jsonb
);

create index accountsUserIdIdx on accounts (userId);

create trigger accountsTouchUpdatedAt
  before update on accounts
  for each row execute function touchUpdatedAt();

create table categories (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  userId uuid not null references users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('expense', 'income', 'transfer')),
  -- A fixed chart color, 1 to 8. A category with none folds into "Other" in
  -- the spending chart, so a color follows its category and never its rank.
  colorSlot integer check (colorSlot between 1 and 8),
  unique (userId, name)
);

create trigger categoriesTouchUpdatedAt
  before update on categories
  for each row execute function touchUpdatedAt();

create table rules (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  userId uuid not null references users(id) on delete cascade,
  -- Matched case-insensitively anywhere in a transaction's description.
  pattern text not null check (length(trim(pattern)) > 0),
  categoryId uuid not null references categories(id) on delete cascade
);

create index rulesUserIdIdx on rules (userId);

create trigger rulesTouchUpdatedAt
  before update on rules
  for each row execute function touchUpdatedAt();

create table budgets (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  userId uuid not null references users(id) on delete cascade,
  categoryId uuid not null references categories(id) on delete cascade,
  amountCents integer not null check (amountCents >= 0),
  unique (userId, categoryId)
);

create trigger budgetsTouchUpdatedAt
  before update on budgets
  for each row execute function touchUpdatedAt();

create table imports (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  userId uuid not null references users(id) on delete cascade,
  accountId uuid not null references accounts(id) on delete cascade,
  fileName text not null,
  addedCount integer not null,
  skippedCount integer not null
);

create index importsUserIdIdx on imports (userId, createdAt desc);

create trigger importsTouchUpdatedAt
  before update on imports
  for each row execute function touchUpdatedAt();

create table transactions (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  userId uuid not null references users(id) on delete cascade,
  accountId uuid not null references accounts(id) on delete cascade,
  postedOn date not null,
  description text not null,
  -- Money in is positive, money out negative.
  amountCents integer not null,
  categoryId uuid references categories(id) on delete set null,
  -- A split transaction has no categoryId and carries its parts here:
  -- [{ categoryId, amountCents }], summing to amountCents.
  splits jsonb,
  -- Identifies an imported row so a re-import skips it: the date, amount and
  -- description, plus which occurrence of that triple it was in its file.
  fingerprint text,
  unique (accountId, fingerprint)
);

create index transactionsUserIdPostedOnIdx on transactions (userId, postedOn);

create trigger transactionsTouchUpdatedAt
  before update on transactions
  for each row execute function touchUpdatedAt();

-- Every write to transactions reaches open pages, whichever path made it: an
-- import, a rule applied in bulk, or a categorize through the live view.
create or replace function transactionsNotify() returns trigger
language plpgsql as $$
declare
  r record;
  payload text;
begin
  r := coalesce(new, old);

  payload := json_build_object(
    'op', lower(tg_op),
    'data', json_build_object(
      'id', r.id,
      'userId', r.userId,
      'accountId', r.accountId,
      'postedOn', to_char(r.postedOn, 'YYYY-MM-DD'),
      'description', r.description,
      'amountCents', r.amountCents,
      'categoryId', r.categoryId,
      'splits', r.splits
    )
  )::text;

  if octet_length(payload) >= 8000 then
    payload := json_build_object('op', lower(tg_op), 'id', r.id)::text;
  end if;

  perform pg_notify(channel_name('transactions'), payload);

  return r;
end;
$$;

create trigger transactionsNotifyTrigger
  after insert or update or delete on transactions
  for each row execute function transactionsNotify();

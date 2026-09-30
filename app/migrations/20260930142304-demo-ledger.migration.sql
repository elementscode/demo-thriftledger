-- demo ledger: one user, three accounts, and six months of activity ending
-- today, with categories, rules and budgets
/** @env development */

create function pg_temp.seedTx(
  owner uuid,
  account uuid,
  day date,
  label text,
  cents integer
) returns void
language sql as $$
  insert into transactions (userId, accountId, postedOn, description, amountCents)
  select owner, account, day, label, cents
   where day <= current_date;
$$;

create function pg_temp.pick(options text[]) returns text
language sql as $$
  select options[1 + floor(random() * array_length(options, 1))::int];
$$;

create function pg_temp.cents(lo numeric, hi numeric) returns integer
language sql as $$
  select round((lo + random() * (hi - lo)) * 100)::integer;
$$;

do $$
declare
  owner uuid;
  checking uuid;
  savings uuid;
  card uuid;
  firstMonth date := (date_trunc('month', current_date) - interval '5 months')::date;
  m date;
  monthDays integer;
  i integer;
  amount integer;
  bulk integer;
  lastCardSpend integer := 84237;
  savingsBalance integer := 1250000;
  groceries uuid;
  shopping uuid;
begin
  perform setseed(0.2026);

  insert into users (email, name, passwordHash)
       values ('maya@thriftledger.dev', 'Maya Okafor', crypt('budget-2026', genSalt('bf', 12)))
    returning id into owner;

  insert into accounts (userId, name, kind, institution, openingBalanceCents, csvMapping)
       values (owner, 'Everyday Checking', 'checking', 'Harborline Credit Union', 324018,
               '{"dateColumn": "Date", "descriptionColumn": "Description", "amountColumn": "Amount", "invertAmounts": false}')
    returning id into checking;

  insert into accounts (userId, name, kind, institution, openingBalanceCents)
       values (owner, 'Rainy Day Savings', 'savings', 'Harborline Credit Union', 1250000)
    returning id into savings;

  insert into accounts (userId, name, kind, institution, openingBalanceCents)
       values (owner, 'Cashback Card', 'credit', 'Lanternfield Bank', -84237)
    returning id into card;

  insert into categories (userId, name, kind, colorSlot) values
    (owner, 'Groceries',     'expense', 1),
    (owner, 'Dining',        'expense', 2),
    (owner, 'Rent',          'expense', 3),
    (owner, 'Transport',     'expense', 4),
    (owner, 'Shopping',      'expense', 5),
    (owner, 'Utilities',     'expense', 6),
    (owner, 'Entertainment', 'expense', 7),
    (owner, 'Health',        'expense', 8),
    (owner, 'Subscriptions', 'expense', null),
    (owner, 'Personal Care', 'expense', null),
    (owner, 'Travel',        'expense', null),
    (owner, 'Gifts',         'expense', null),
    (owner, 'Paycheck',      'income',  null),
    (owner, 'Interest',      'income',  null),
    (owner, 'Transfers',     'transfer', null);

  select id into groceries from categories where userId = owner and name = 'Groceries';
  select id into shopping from categories where userId = owner and name = 'Shopping';

  insert into rules (userId, pattern, categoryId)
  select owner, r.pattern, c.id
    from (values
      ('fernleaf market', 'Groceries'),
      ('greencart', 'Groceries'),
      ('hollow oak', 'Groceries'),
      ('maplerow', 'Groceries'),
      ('kettlebird', 'Dining'),
      ('casa verde', 'Dining'),
      ('leafwell', 'Dining'),
      ('dashplate', 'Dining'),
      ('crumbhouse', 'Dining'),
      ('pizzeria', 'Dining'),
      ('oakwood property', 'Rent'),
      ('sunpoint fuel', 'Transport'),
      ('meridian gas', 'Transport'),
      ('zipride', 'Transport'),
      ('baypass', 'Transport'),
      ('parcelway', 'Shopping'),
      ('brightaisle', 'Shopping'),
      ('trailhead outfitters', 'Shopping'),
      ('baylight energy', 'Utilities'),
      ('waveline', 'Utilities'),
      ('city water', 'Utilities'),
      ('lumiere cinema', 'Entertainment'),
      ('tixloop', 'Entertainment'),
      ('pixelvault', 'Entertainment'),
      ('ironleaf gym', 'Health'),
      ('cornerwell pharmacy', 'Health'),
      ('streamnest', 'Subscriptions'),
      ('tunefield', 'Subscriptions'),
      ('cloudkeep', 'Subscriptions'),
      ('shear joy', 'Personal Care'),
      ('skypine air', 'Travel'),
      ('harborview hotel', 'Travel'),
      ('payroll', 'Paycheck'),
      ('interest payment', 'Interest'),
      ('transfer to savings', 'Transfers'),
      ('transfer from checking', 'Transfers'),
      ('lanternfield card payment', 'Transfers'),
      ('payment thank you', 'Transfers')
    ) as r(pattern, category)
    join categories c on c.userId = owner and c.name = r.category;

  insert into budgets (userId, categoryId, amountCents)
  select owner, c.id, b.cents
    from (values
      ('Groceries', 60000),
      ('Dining', 32500),
      ('Rent', 185000),
      ('Transport', 25000),
      ('Shopping', 30000),
      ('Utilities', 28000),
      ('Entertainment', 12000),
      ('Health', 10000),
      ('Subscriptions', 4000),
      ('Personal Care', 4000)
    ) as b(category, cents)
    join categories c on c.userId = owner and c.name = b.category;

  for month in 0..5 loop
    m := (firstMonth + make_interval(months => month))::date;
    monthDays := extract(day from (m + interval '1 month' - interval '1 day'))::integer;

    -- Checking: pay in, rent and bills out, the card paid off, savings topped up.
    perform pg_temp.seedTx(owner, checking, m, 'LINDENWORKS PAYROLL DIRECT DEP', 285000);
    perform pg_temp.seedTx(owner, checking, m + 14, 'LINDENWORKS PAYROLL DIRECT DEP', 285000);
    perform pg_temp.seedTx(owner, checking, m, 'OAKWOOD PROPERTY MGMT RENT', -185000);
    perform pg_temp.seedTx(owner, checking, m + 2, 'IRONLEAF GYM MEMBERSHIP', -4500);
    perform pg_temp.seedTx(owner, checking, m + 7, 'BAYLIGHT ENERGY AUTOPAY', -pg_temp.cents(78, 142));
    perform pg_temp.seedTx(owner, checking, m + 11, 'WAVELINE INTERNET', -6999);
    perform pg_temp.seedTx(owner, checking, m + 19, 'CITY WATER UTILITY', -pg_temp.cents(41, 58));
    perform pg_temp.seedTx(owner, checking, m + 15, 'TRANSFER TO SAVINGS ****4471', -50000);
    perform pg_temp.seedTx(owner, checking, m + 24, 'LANTERNFIELD CARD PAYMENT', -lastCardSpend);

    -- Savings: the transfer lands, interest posts on the last day.
    perform pg_temp.seedTx(owner, savings, m + 15, 'TRANSFER FROM CHECKING ****2210', 50000);
    savingsBalance := savingsBalance + 50000;
    amount := round(savingsBalance * 0.041 / 12)::integer;
    perform pg_temp.seedTx(owner, savings, m + monthDays - 1, 'INTEREST PAYMENT', amount);
    savingsBalance := savingsBalance + amount;

    -- The card: everyday spending.
    perform pg_temp.seedTx(owner, card, m + 24, 'PAYMENT THANK YOU', lastCardSpend);

    for i in 1..(6 + floor(random() * 3)::integer) loop
      perform pg_temp.seedTx(owner, card, m + floor(random() * monthDays)::integer,
        pg_temp.pick(array['FERNLEAF MARKET #512', 'GREENCART FOODS #1843', 'HOLLOW OAK GROCERS #10233', 'MAPLEROW FOOD COOP']),
        -pg_temp.cents(34, 148));
    end loop;

    for i in 1..(8 + floor(random() * 5)::integer) loop
      perform pg_temp.seedTx(owner, card, m + floor(random() * monthDays)::integer,
        pg_temp.pick(array['KETTLEBIRD COFFEE', 'CASA VERDE TAQUERIA 2291', 'LEAFWELL SALADS MISSION', 'DASHPLATE*THAI BASIL', 'CRUMBHOUSE BAKERY', 'PIZZERIA FORNELLO']),
        -pg_temp.cents(6, 64));
    end loop;

    for i in 1..2 loop
      perform pg_temp.seedTx(owner, card, m + floor(random() * monthDays)::integer,
        pg_temp.pick(array['SUNPOINT FUEL 5741', 'MERIDIAN GAS 0921']), -pg_temp.cents(42, 66));
      perform pg_temp.seedTx(owner, card, m + floor(random() * monthDays)::integer,
        'ZIPRIDE *TRIP', -pg_temp.cents(11, 34));
    end loop;

    perform pg_temp.seedTx(owner, card, m + 3, 'BAYPASS TRANSIT RELOAD', -5000);

    for i in 1..(2 + floor(random() * 3)::integer) loop
      perform pg_temp.seedTx(owner, card, m + floor(random() * monthDays)::integer,
        pg_temp.pick(array['PARCELWAY.COM*MK2L81', 'BRIGHTAISLE 00012', 'TRAILHEAD OUTFITTERS #87']),
        -pg_temp.cents(14, 128));
    end loop;

    perform pg_temp.seedTx(owner, card, m + 4, 'STREAMNEST.TV', -1549);
    perform pg_temp.seedTx(owner, card, m + 9, 'TUNEFIELD MUSIC', -1199);
    perform pg_temp.seedTx(owner, card, m + 12, 'CLOUDKEEP STORAGE', -299);
    perform pg_temp.seedTx(owner, card, m + 17, 'SHEAR JOY SALON #4410', -2800);
    perform pg_temp.seedTx(owner, card, m + floor(random() * monthDays)::integer,
      pg_temp.pick(array['LUMIERE CINEMA 8', 'TIXLOOP *JAZZ NIGHT', 'PIXELVAULT GAMES']),
      -pg_temp.cents(12, 58));

    if random() < 0.6 then
      perform pg_temp.seedTx(owner, card, m + floor(random() * monthDays)::integer,
        'CORNERWELL PHARMACY #0921', -pg_temp.cents(9, 46));
    end if;

    if month = 2 then
      perform pg_temp.seedTx(owner, card, m + 5, 'SKYPINE AIR 0272149', -38940);
      perform pg_temp.seedTx(owner, card, m + 20, 'HARBORVIEW HOTEL SEATTLE', -51216);
    end if;

    -- A warehouse run every month, split between groceries and household.
    bulk := pg_temp.cents(168, 262);
    if m + 21 <= current_date then
      insert into transactions (userId, accountId, postedOn, description, amountCents, splits)
           values (owner, card, m + 21, 'BULKHAVEN WHSE #0144', -bulk,
                   jsonb_build_array(
                     jsonb_build_object('categoryId', groceries, 'amountCents', -round(bulk * 0.62)::integer),
                     jsonb_build_object('categoryId', shopping, 'amountCents', -(bulk - round(bulk * 0.62)::integer))
                   ));
    end if;

    select coalesce(-sum(amountCents), 0)::integer into lastCardSpend
      from transactions
     where accountId = card
       and amountCents < 0
       and postedOn >= m
       and postedOn < m + interval '1 month';
  end loop;

  -- This month's rows no rule knows yet, waiting to be categorized.
  m := date_trunc('month', current_date)::date;
  perform pg_temp.seedTx(owner, card, greatest(m, current_date - 9), 'OUTER SUNSET FARMERS MKT', -3825);
  perform pg_temp.seedTx(owner, card, greatest(m, current_date - 7), 'KILNWORKS CERAMICS', -6400);
  perform pg_temp.seedTx(owner, checking, greatest(m, current_date - 6), 'PAYPEER *J PARK DINNER', -4250);
  perform pg_temp.seedTx(owner, card, greatest(m, current_date - 4), 'PAGETURN BOOKS', -2799);
  perform pg_temp.seedTx(owner, card, greatest(m, current_date - 3), 'BRIGHTWAY DRUG #3310', -1647);
  perform pg_temp.seedTx(owner, card, greatest(m, current_date - 1), 'HOPCAR *RIDE SUN 7PM', -1918);

  update transactions t
     set categoryId = (
           select r.categoryId
             from rules r
            where r.userId = owner
              and t.description ilike '%' || r.pattern || '%'
            order by length(r.pattern) desc, r.createdAt
            limit 1
         )
   where t.userId = owner
     and t.splits is null;

  -- The same fingerprint the importer computes, so a re-imported row is
  -- recognized as one already here.
  update transactions t
     set fingerprint = f.fp
    from (
      select id,
             to_char(postedOn, 'YYYY-MM-DD') || '|' || amountCents || '|' || key || '|' ||
               row_number() over (partition by accountId, postedOn, amountCents, key order by id) as fp
        from (
          select id, accountId, postedOn, amountCents,
                 lower(regexp_replace(trim(description), '\s+', ' ', 'g')) as key
            from transactions
           where userId = owner
        ) k
    ) f
   where f.id = t.id;

  insert into imports (userId, accountId, fileName, addedCount, skippedCount, createdAt)
  select owner, accountId, 'initial history', count(*)::integer, 0, now() - interval '1 day'
    from transactions
   where userId = owner
   group by accountId;
end;
$$;

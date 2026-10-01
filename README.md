![Thriftledger, a personal budgeting app built with Elements: the September budget with spent and remaining bars for each category, two categories over budget, and six transactions waiting for a category.](https://elements.dev/demos/01a0f44b-9270-7c8f-81dc-920795810634/poster?v=ecad76d61285)

# Thriftledger

> A demo app built with [Elements](https://elements.dev).

Bank accounts, CSV import that skips duplicates, rules that categorize, monthly budgets and spending reports.

**Demo:** [Thriftledger](https://elements.dev/demos/01a0f44b-9270-7c8f-81dc-920795810634)

## Agent specs

What one run of the prompt below took, from an empty Elements project to this
app.

- **Agent:** Claude Code, Opus 5.5 Medium
- **Time:** 24 min
- **Cost:** $8.30 at API rates, September 2026

## Get started

```bash
elements create thriftledger -scaffold=elementscode/demo-thriftledger
```

## How it's built

Thriftledger needed a ledger that stays current in every open tab, a CSV importer that knows what it has already seen, rules that sort spending, and budgets that move as transactions arrive. Each of those is a part of Elements, so the agent spent its 24 minutes on the money itself.

### What Elements gave the app

- **A live ledger.** Accounts, categories, rules, budgets, imports and transactions are six LiveTables in `app/shared/services/ledger.ts`, each opened partitioned by the signed-in user. A `transactionsNotify` trigger carries every write to the open pages, so the dashboard's budgets move the moment an import lands in another tab.
- **Import as a function call.** The import page reads the chosen file with `File.read` and previews it in the browser, then calls `importCsv`, an `@rpc` that parses the rows on the server and inserts them in one transaction. Each row has a fingerprint with `on conflict do nothing`, so a re-import skips what is already there, and the column mapping is saved to the account for that bank's next export.
- **Rules that categorize.** Every imported row takes the longest matching rule, and `applyRules` runs the rules over everything still uncategorized in a single SQL update. Transaction edits go through the `transactions` LiveTable, which checks that a split's parts add up to the whole.
- **Reports from the data.** `/reports` draws its spending charts as SVG from the ledger's own rows, with tick and label helpers in `app/pages/reports/charts.ts`.
- **Data from SQL files.** Two migrations define the ledger and seed one household with three accounts, categories, rules, budgets and six months of activity ending today.

### What the agent got from the tooling

The agent ran 20 builds in 24 minutes. It checked its work after each edit and kept going. Along the way the build caught seven errors in the reports template, among them arrays passed where a string belonged and a tag that named no template, each pointed at its file and line. The agent read the manual for each part as it reached it, 39 pages from `recipes/live-dashboard` and `livetable/partitions` to `recipes/file-upload`, then wrote 28 tests. In a real browser it imported in one tab and watched the budget update in another, and checked every page at phone width and the reports in dark mode.

Start in `app/shared/services/ledger.ts`.

## Seed data and demo account

The development seed creates one user with three accounts (Everyday Checking,
Rainy Day Savings and a Cashback Card) and six months of transactions ending
today: paychecks, rent, bills, card payments, savings transfers, interest,
everyday spending, one trip, and a monthly warehouse run split between
Groceries and Shopping. It also adds 15 categories, 38 rules and 10 monthly
budgets, and leaves six recent transactions uncategorized. Every merchant name
is made up.

| Email                 | Password      |
| --------------------- | ------------- |
| maya@thriftledger.dev | `budget-2026` |

The sign-in page shows the login with a one-click button. The Import page has
a sample card export to try: two weeks the ledger already has, which it skips,
and six new purchases.

## The prompt

```text
Build a personal budgeting app named thriftledger.

- Accounts. Add bank accounts (checking, savings, credit card).
- Import transactions from a bank CSV export: map the date, description and
  amount columns once per account, and skip duplicates.
- Categorize transactions; rules that categorize by description
  automatically.
- A monthly budget per category, with spent and remaining.
- Reports: spending by category (donut), income versus spending by month
  (bars), and net worth over time.
- Split a transaction across categories.

Seed one user with three accounts, six months of realistic transactions,
categories, rules and budgets. Show the seeded login on the sign-in page.

Budgets and reports update in real time as transactions are imported and
categorized.
```

## License

MIT. See [LICENSE](LICENSE).

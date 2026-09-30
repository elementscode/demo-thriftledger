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

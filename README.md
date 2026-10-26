![Budgets and spending reports, built by Claude Code on Elements: the September budget with spent and remaining bars for each category, two categories over budget, and six transactions waiting for a category.](https://elements.dev/demos/01a0f44b-9270-7c8f-81dc-920795810634/poster?v=ecad76d61285)

# Budgets and spending reports, built by Claude Code on Elements

> Thriftledger is a full-stack app built with Claude Code on Elements.

Bank accounts, CSV import that skips duplicates, rules that categorize, monthly budgets and spending reports.

[Run this app on your machine](https://elements.dev/demos/01a0f44b-9270-7c8f-81dc-920795810634). Use this demo as inspiration, or as the starting point for your own app. Your agent creates a new app with this one as the scaffold, and you prompt it to add whatever features you want.

## How it's built

Thriftledger needed a ledger that stays current in every open tab, a CSV importer that knows what it has already seen, rules that sort spending, and budgets that move as transactions arrive. Each of those is a part of Elements, so the agent spent its 24 minutes on the money itself.

- **A live ledger.** Accounts, categories, rules, budgets, imports and transactions are LiveTables, each opened for the signed-in household. A trigger carries every transaction write to the open pages, so the dashboard's budgets move the moment an import lands in another tab.

- **CSV import as a function call.** The import page previews the file in the browser, then sends it to an `@rpc` that parses the rows on the server and inserts them in one transaction. Each row carries a fingerprint, so a re-import skips what is already there, and the column mapping is saved for that bank's next export.

- **Rules that categorize.** Every imported row takes the longest matching rule, and one rpc runs the rules over everything still uncategorized in a single SQL update. Edits go through the transactions LiveTable, which checks that a split's parts add up to the whole.

- **Reports from the data.** The reports page draws its spending charts as SVG from the ledger's own rows.

- **Data from SQL files.** Two migrations define the ledger and seed one household with three accounts, categories, rules, budgets and six months of activity ending today.

## Why Elements

Elements is an integrated full-stack app framework and a project server. The project server checks the agent's work as it builds: it type-checks the server and browser code, analyzes the program, applies migrations and runs the tests, then reports the results to the agent. A security mistake, such as calling a server-only function from the browser, is a compile error. The agent reads the report and fixes its own mistakes before it tells you a feature is done. The same checks run on every feature you ask for next.

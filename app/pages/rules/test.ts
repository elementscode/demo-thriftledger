import { test, equal, sql } from "@elements/app";
import { ledgerViews, rules } from "#app/shared/services/ledger";
import { addTransaction, makeLedger } from "#app/shared/services/fixtures";
import { waitingFor } from "./template";

test("rules page", () => {
  test("counts the uncategorized rows a rule would file", () => {
    let ledger = makeLedger();
    addTransaction(ledger.userId, ledger.checking.id, "2026-09-03", "HOLLOW OAK GROCERS", -3000);
    addTransaction(ledger.userId, ledger.checking.id, "2026-09-04", "HOLLOW OAK GROCERS", -2000, ledger.groceries.id);
    addTransaction(ledger.userId, ledger.checking.id, "2026-09-05", "UNKNOWN", -1000);
    sql(`insert into rules (userId, pattern, categoryId) values (${ledger.userId}, 'hollow oak', ${ledger.groceries.id})`);

    let { transactions } = ledgerViews(ledger.userId);
    equal(waitingFor(transactions, rules.view({ userId: ledger.userId })), 1);
  });
});

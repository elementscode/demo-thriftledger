import { test, equal } from "@elements/app";
import { ledgerViews } from "#app/shared/services/ledger";
import { addTransaction, makeLedger } from "#app/shared/services/fixtures";
import { slices } from "./template";

test("reports page", () => {
  test("the donut keeps each category's color and folds the rest into Other", () => {
    let ledger = makeLedger();
    addTransaction(ledger.userId, ledger.checking.id, "2026-09-03", "GREENCART FOODS", -3000, ledger.groceries.id);
    addTransaction(ledger.userId, ledger.checking.id, "2026-09-04", "CRUMBHOUSE BAKERY", -1000, ledger.dining.id);
    addTransaction(ledger.userId, ledger.checking.id, "2026-09-05", "MYSTERY", -1000);
    addTransaction(ledger.userId, ledger.checking.id, "2026-09-06", "PAYMENT", -50000, ledger.transfers.id);

    let { categories, transactions } = ledgerViews(ledger.userId);
    let rows = slices(categories, transactions, "2026-09");

    equal(rows.map((r) => [r.name, r.color, r.cents]), [
      ["Groceries", "var(--series-1)", 3000],
      ["Dining", "var(--series-2)", 1000],
      ["Other", "var(--series-other)", 1000],
    ]);
    equal(rows[0].share, 0.6);
  });
});

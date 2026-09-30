import { test, equal } from "@elements/app";
import { ledgerViews } from "#app/shared/services/ledger";
import { addTransaction, makeLedger } from "#app/shared/services/fixtures";
import { visible } from "./template";

test("transactions page", () => {
  test("filters by search, month and category state, newest first", () => {
    let ledger = makeLedger();
    addTransaction(ledger.userId, ledger.checking.id, "2026-09-03", "GREENCART FOODS #1843", -12500, ledger.groceries.id);
    addTransaction(ledger.userId, ledger.checking.id, "2026-09-09", "PAGETURN BOOKS", -2799);
    addTransaction(ledger.userId, ledger.checking.id, "2026-08-30", "GREENCART FOODS #1843", -9999);

    let { transactions } = ledgerViews(ledger.userId);
    let base = { search: "", accountId: "", month: "", uncategorized: false, limit: 100 };

    equal(visible(transactions, base).map((t) => t.postedOn), ["2026-09-09", "2026-09-03", "2026-08-30"]);
    equal(visible(transactions, { ...base, search: "greencart" }).length, 2);
    equal(visible(transactions, { ...base, month: "2026-09", uncategorized: true }).map((t) => t.description), ["PAGETURN BOOKS"]);
  });
});

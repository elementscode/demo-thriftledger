import { test, equal, sql } from "@elements/app";
import { budgets, ledgerViews } from "#app/shared/services/ledger";
import { addTransaction, makeLedger } from "#app/shared/services/fixtures";
import { lines, totals } from "./template";

test("budget page", () => {
  test("shows spent and remaining per category for the month", () => {
    let ledger = makeLedger();
    sql(`insert into budgets (userId, categoryId, amountCents) values (${ledger.userId}, ${ledger.groceries.id}, 40000)`);
    addTransaction(ledger.userId, ledger.checking.id, "2026-09-03", "GREENCART FOODS", -12500, ledger.groceries.id);
    addTransaction(ledger.userId, ledger.checking.id, "2026-09-09", "GREENCART FOODS", -2500, ledger.groceries.id);
    addTransaction(ledger.userId, ledger.checking.id, "2026-08-30", "GREENCART FOODS", -9999, ledger.groceries.id);
    addTransaction(ledger.userId, ledger.checking.id, "2026-09-10", "MYSTERY", -700);

    let views = ledgerViews(ledger.userId);
    let all = lines(views.categories, budgets.view({ userId: ledger.userId }), views.transactions, "2026-09");
    let groceries = all.find((l) => l.id === ledger.groceries.id)!;

    equal(groceries.spentCents, 15000);
    equal(groceries.budget?.amountCents, 40000);
    equal(all.find((l) => l.id === "uncategorized")?.spentCents, 700);
    equal(totals(all).remaining, 25000);
  });
});

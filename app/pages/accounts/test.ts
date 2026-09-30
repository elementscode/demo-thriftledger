import { test, equal, sql } from "@elements/app";
import { ledgerViews } from "#app/shared/services/ledger";
import { addTransaction, makeLedger } from "#app/shared/services/fixtures";
import { summary } from "./template";

test("accounts page", () => {
  test("a card balance counts as owed against net worth", () => {
    let ledger = makeLedger();
    let card = sql<{ id: string }>(`
      insert into accounts (userId, name, kind, openingBalanceCents)
           values (${ledger.userId}, 'Card', 'credit', -30000)
        returning id
    `).firstOrThrow();

    addTransaction(ledger.userId, card.id, "2026-09-03", "GREENCART FOODS", -5000);
    addTransaction(ledger.userId, ledger.checking.id, "2026-09-04", "PAYROLL", 20000);

    let { accounts, transactions } = ledgerViews(ledger.userId);
    equal(summary(accounts, transactions), { assets: 120000, debts: 35000, net: 85000 });
  });
});

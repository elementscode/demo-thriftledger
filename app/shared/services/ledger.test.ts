import { test, equal, assert, sql, session } from "@elements/app";
import { applyRules, importCsv, rules, transactions } from "#app/shared/services/ledger";
import { addTransaction, makeLedger } from "#app/shared/services/fixtures";

const MAPPING = { dateColumn: "Date", descriptionColumn: "Description", amountColumn: "Amount", invertAmounts: false };

const FILE = [
  "Date,Description,Amount",
  "09/01/2026,FERNLEAF MARKET #512,-54.20",
  "09/01/2026,KETTLEBIRD COFFEE,-4.50",
  "09/01/2026,KETTLEBIRD COFFEE,-4.50",
  "09/02/2026,LINDENWORKS PAYROLL,2500.00",
].join("\n");

function count(userId: string): number {
  return sql<{ n: number }>(`select count(*)::int as n from transactions where userId = ${userId}`).firstOrThrow().n;
}

test("ledger services", () => {
  test("an import adds every row, keeps same-day repeats, and applies rules", () => {
    let ledger = makeLedger();
    sql(`insert into rules (userId, pattern, categoryId) values (${ledger.userId}, 'fernleaf market', ${ledger.groceries.id})`);

    let result = importCsv({ accountId: ledger.checking.id, fileName: "sept.csv", text: FILE, mapping: MAPPING });

    equal(result.added, 4);
    equal(result.skipped, 0);
    equal(result.categorized, 1);

    let fernleaf = sql<{ categoryId: string }>(`select categoryId from transactions where description like 'FERNLEAF%'`).firstOrThrow();
    equal(fernleaf.categoryId, ledger.groceries.id);
  });

  test("re-importing the same file, or one that overlaps it, skips what is there", () => {
    let ledger = makeLedger();
    importCsv({ accountId: ledger.checking.id, fileName: "sept.csv", text: FILE, mapping: MAPPING });

    let again = importCsv({ accountId: ledger.checking.id, fileName: "sept.csv", text: FILE, mapping: MAPPING });
    equal(again.added, 0);
    equal(again.skipped, 4);

    let overlap = importCsv({
      accountId: ledger.checking.id,
      fileName: "later.csv",
      text: FILE + "\n09/03/2026,KETTLEBIRD COFFEE,-4.50\n09/01/2026,KETTLEBIRD COFFEE,-4.50",
      mapping: MAPPING,
    });
    equal(overlap.added, 2, "a new day, and a third identical coffee on the first");
    equal(count(ledger.userId), 6);
  });

  test("the mapping is remembered on the account", () => {
    let ledger = makeLedger();
    importCsv({ accountId: ledger.checking.id, fileName: "sept.csv", text: FILE, mapping: MAPPING });

    let saved = sql<{ csvMapping: typeof MAPPING }>(`select csvMapping from accounts where id = ${ledger.checking.id}`).firstOrThrow();
    equal(saved.csvMapping, MAPPING);
  });

  test("nobody imports into someone else's account", () => {
    let ledger = makeLedger();
    makeLedger("mallory@example.com");

    let refused = false;

    try {
      importCsv({ accountId: ledger.checking.id, fileName: "x.csv", text: FILE, mapping: MAPPING });
    } catch {
      refused = true;
    }

    assert(refused);
    equal(count(ledger.userId), 0);
  });

  test("a split must add up to the transaction", () => {
    let ledger = makeLedger();
    let id = addTransaction(ledger.userId, ledger.checking.id, "2026-09-05", "BULKHAVEN WHSE", -10000);
    let view = transactions.view({ userId: ledger.userId });
    let row = view.get(id)!;

    let refused = false;

    try {
      view.update({ ...row, splits: [{ categoryId: ledger.groceries.id, amountCents: -6000 }, { categoryId: ledger.dining.id, amountCents: -3000 }] });
    } catch {
      refused = true;
    }

    assert(refused, "parts short of the total are refused");

    view.update({ ...row, splits: [{ categoryId: ledger.groceries.id, amountCents: -6000 }, { categoryId: ledger.dining.id, amountCents: -4000 }] });

    let stored = sql<{ categoryId: string | null; splits: unknown[] }>(`select categoryId, splits from transactions where id = ${id}`).firstOrThrow();
    equal(stored.categoryId, null);
    equal(stored.splits.length, 2);
  });

  test("a new rule categorizes the transactions waiting for it", () => {
    let ledger = makeLedger();
    addTransaction(ledger.userId, ledger.checking.id, "2026-09-05", "HOPCAR *RIDE SUN 7PM", -1918);
    addTransaction(ledger.userId, ledger.checking.id, "2026-09-06", "HOPCAR *RIDE MON 9AM", -1200, ledger.groceries.id);

    rules.view({ userId: ledger.userId }).insert({ pattern: "Hopcar", categoryId: ledger.dining.id });

    let rows = sql<{ categoryId: string }>(`select categoryId from transactions where userId = ${ledger.userId} order by postedOn`).all();
    equal(rows.map((r) => r.categoryId), [ledger.dining.id, ledger.groceries.id], "an already categorized row is left alone");
  });

  test("apply rules fills in only uncategorized rows", () => {
    let ledger = makeLedger();
    addTransaction(ledger.userId, ledger.checking.id, "2026-09-05", "HOLLOW OAK GROCERS", -3000);
    addTransaction(ledger.userId, ledger.checking.id, "2026-09-06", "UNKNOWN MERCHANT", -500);
    sql(`insert into rules (userId, pattern, categoryId) values (${ledger.userId}, 'hollow oak', ${ledger.groceries.id})`);

    equal(applyRules(), 1);
    equal(applyRules(), 0);
  });

  test("a transaction cannot be recategorized by another user", () => {
    let ledger = makeLedger();
    let id = addTransaction(ledger.userId, ledger.checking.id, "2026-09-05", "RENT", -150000);
    let row = transactions.view({ userId: ledger.userId }).get(id)!;

    let other = makeLedger("mallory@example.com");
    let refused = false;

    try {
      transactions.view({ userId: other.userId }).update({ ...row, userId: other.userId, categoryId: other.dining.id });
    } catch {
      refused = true;
    }

    assert(refused);
    equal(sql<{ categoryId: string | null }>(`select categoryId from transactions where id = ${id}`).firstOrThrow().categoryId, null);
    assert(session.get("userId") === other.userId);
  });
});

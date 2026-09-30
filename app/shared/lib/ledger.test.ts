import { test, equal } from "@elements/app";
import {
  Account,
  Category,
  Rule,
  Transaction,
  UNCATEGORIZED,
  byCategoryId,
  matchRule,
  monthlyFlows,
  netWorthSeries,
  parseMoneyInput,
  shiftMonth,
  spendingByCategory,
  suggestPattern,
} from "#app/shared/lib/ledger";

const categories: Category[] = [
  { id: "g", userId: "u", name: "Groceries", kind: "expense", colorSlot: 1 },
  { id: "h", userId: "u", name: "Household", kind: "expense", colorSlot: 2 },
  { id: "pay", userId: "u", name: "Paycheck", kind: "income", colorSlot: null },
  { id: "xfer", userId: "u", name: "Transfers", kind: "transfer", colorSlot: null },
];

function txn(id: string, postedOn: string, amountCents: number, categoryId: string | null, splits: Transaction["splits"] = null): Transaction {
  return { id, userId: "u", accountId: "a", postedOn, description: id, amountCents, categoryId, splits };
}

const transactions = [
  txn("store", "2026-09-03", -5000, "g"),
  txn("refund", "2026-09-04", 1000, "g"),
  txn("warehouse", "2026-09-05", -10000, null, [{ categoryId: "g", amountCents: -6000 }, { categoryId: "h", amountCents: -4000 }]),
  txn("pay", "2026-09-01", 300000, "pay"),
  txn("card payment", "2026-09-20", -80000, "xfer"),
  txn("mystery", "2026-09-21", -700, null),
  txn("august", "2026-08-30", -9900, "g"),
];

test("ledger", () => {
  test("spending counts split parts and refunds, and leaves out transfers and income", () => {
    let spent = spendingByCategory(transactions, byCategoryId(categories), "2026-09");
    equal(spent.get("g"), 5000 - 1000 + 6000);
    equal(spent.get("h"), 4000);
    equal(spent.get(UNCATEGORIZED), 700);
    equal(spent.has("xfer"), false);
    equal(spent.has("pay"), false);
  });

  test("monthly flows separate income from spending", () => {
    let flows = monthlyFlows(transactions, byCategoryId(categories), ["2026-08", "2026-09"]);
    equal(flows[0], { month: "2026-08", incomeCents: 0, spendingCents: 9900 });
    equal(flows[1], { month: "2026-09", incomeCents: 300000, spendingCents: 14700 });
  });

  test("net worth starts at the opening balances and ends at today's", () => {
    let accounts: Account[] = [
      { id: "a", userId: "u", name: "Checking", kind: "checking", institution: "", openingBalanceCents: 50000, csvMapping: null, createdAt: new Date() },
      { id: "c", userId: "u", name: "Card", kind: "credit", institution: "", openingBalanceCents: -20000, csvMapping: null, createdAt: new Date() },
    ];
    let series = netWorthSeries(accounts, [txn("one", "2026-01-02", 1500, null)]);
    equal(series[0], { day: "2026-01-01", cents: 30000 });
    equal(series[series.length - 1].cents, 31500);
  });

  test("the longest matching rule wins", () => {
    let rules: Rule[] = [
      { id: "1", userId: "u", pattern: "oak", categoryId: "h", createdAt: new Date() },
      { id: "2", userId: "u", pattern: "hollow oak", categoryId: "g", createdAt: new Date() },
    ];
    equal(matchRule(rules, "HOLLOW OAK GROCERS #10233")?.id, "2");
    equal(matchRule(rules, "GREENCART FOODS"), undefined);
  });

  test("suggests the merchant as a rule pattern", () => {
    equal(suggestPattern("HOPCAR *RIDE SUN 7PM"), "hopcar");
    equal(suggestPattern("SQ *OUTER SUNSET FARMERS MKT"), "outer sunset farmers");
    equal(suggestPattern("FERNLEAF MARKET #512"), "fernleaf market");
    equal(suggestPattern("PAGETURN BOOKS"), "pageturn books");
  });

  test("months and money inputs", () => {
    equal(shiftMonth("2026-01", -1), "2025-12");
    equal(shiftMonth("2026-11", 3), "2027-02");
    equal(parseMoneyInput("$1,250.5"), 125050);
    equal(Number.isNaN(parseMoneyInput("12.345")), true);
  });
});
